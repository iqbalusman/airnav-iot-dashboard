#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/env.sh" ]; then
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/env.sh"
fi

: "${PROJECT_ID:?Isi PROJECT_ID di deploy/google-cloud/env.sh}"
: "${ZONE:=asia-southeast2-a}"
: "${VM_NAME:=airnav-yolo-backend}"
: "${VM_USER:=$USER}"

MODEL_PATH="${MODEL_PATH:-models/best.pt}"
REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/airnav-iot-dashboard}"

if [ ! -f "$MODEL_PATH" ]; then
  echo "Model tidak ditemukan: $MODEL_PATH"
  exit 1
fi

gcloud config set project "$PROJECT_ID"

gcloud compute ssh "$VM_USER@$VM_NAME" --zone "$ZONE" --command "sudo mkdir -p $REMOTE_APP_DIR/models && sudo chown -R $VM_USER:$VM_USER $REMOTE_APP_DIR/models"
gcloud compute scp "$MODEL_PATH" "$VM_USER@$VM_NAME:$REMOTE_APP_DIR/models/best.pt" --zone "$ZONE"
gcloud compute ssh "$VM_USER@$VM_NAME" --zone "$ZONE" --command "sudo systemctl restart airnav-yolo && sudo systemctl status airnav-yolo --no-pager"

echo "Model berhasil diupload dan service airnav-yolo direstart."

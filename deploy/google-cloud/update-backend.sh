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

REMOTE_APP_DIR="${REMOTE_APP_DIR:-/opt/airnav-iot-dashboard}"

gcloud config set project "$PROJECT_ID"

gcloud compute ssh "$VM_USER@$VM_NAME" --zone "$ZONE" --command "
  set -e
  cd $REMOTE_APP_DIR
  git pull --ff-only
  . .venv/bin/activate
  pip install -r yolo_backend/requirements.txt
  sudo systemctl restart airnav-yolo
  sudo systemctl status airnav-yolo --no-pager
"

echo "Backend di VM berhasil diupdate."

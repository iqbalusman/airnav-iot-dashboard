#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$SCRIPT_DIR/env.sh" ]; then
  # shellcheck disable=SC1091
  . "$SCRIPT_DIR/env.sh"
fi

: "${PROJECT_ID:?Isi PROJECT_ID di deploy/google-cloud/env.sh}"
: "${ZONE:=asia-southeast2-a}"
: "${REGION:=asia-southeast2}"
: "${VM_NAME:=airnav-yolo-backend}"
: "${MACHINE_TYPE:=e2-standard-4}"
: "${BOOT_DISK_SIZE:=40GB}"
: "${REPO_URL:=https://github.com/iqbalusman/airnav-iot-dashboard.git}"
: "${CAMERA_SOURCE:=http://192.168.1.51/stream}"
: "${YOLO_DOMAIN:=yolo.airnavgorontalo.com}"
: "${TAILSCALE_AUTH_KEY:=}"

ADDRESS_NAME="${VM_NAME}-ip"
FIREWALL_NAME="${VM_NAME}-allow-web"

gcloud config set project "$PROJECT_ID"

if ! gcloud compute addresses describe "$ADDRESS_NAME" --region "$REGION" >/dev/null 2>&1; then
  gcloud compute addresses create "$ADDRESS_NAME" --region "$REGION"
fi

STATIC_IP="$(gcloud compute addresses describe "$ADDRESS_NAME" --region "$REGION" --format='value(address)')"

if ! gcloud compute firewall-rules describe "$FIREWALL_NAME" >/dev/null 2>&1; then
  gcloud compute firewall-rules create "$FIREWALL_NAME" \
    --allow tcp:80,tcp:443 \
    --target-tags airnav-yolo \
    --description "Allow HTTP/HTTPS to AirNav YOLO backend reverse proxy"
fi

STARTUP_FILE="$(mktemp)"
{
  echo "#!/usr/bin/env bash"
  echo "export REPO_URL='$REPO_URL'"
  echo "export CAMERA_SOURCE='$CAMERA_SOURCE'"
  echo "export YOLO_DOMAIN='$YOLO_DOMAIN'"
  echo "export TAILSCALE_AUTH_KEY='$TAILSCALE_AUTH_KEY'"
  cat "$SCRIPT_DIR/startup-airnav-yolo.sh"
} > "$STARTUP_FILE"

if gcloud compute instances describe "$VM_NAME" --zone "$ZONE" >/dev/null 2>&1; then
  echo "VM $VM_NAME sudah ada. Update metadata startup script dan restart VM..."
  gcloud compute instances add-metadata "$VM_NAME" \
    --zone "$ZONE" \
    --metadata-from-file startup-script="$STARTUP_FILE"
  gcloud compute instances reset "$VM_NAME" --zone "$ZONE" --quiet
else
  gcloud compute instances create "$VM_NAME" \
    --zone "$ZONE" \
    --machine-type "$MACHINE_TYPE" \
    --image-family ubuntu-2204-lts \
    --image-project ubuntu-os-cloud \
    --boot-disk-size "$BOOT_DISK_SIZE" \
    --address "$STATIC_IP" \
    --tags airnav-yolo \
    --metadata-from-file startup-script="$STARTUP_FILE"
fi

rm -f "$STARTUP_FILE"

cat <<EOF

VM AirNav YOLO dibuat/diperbarui.

External IP:
  $STATIC_IP

Langkah DNS:
  Buat A record:
  $YOLO_DOMAIN -> $STATIC_IP

Setelah DNS aktif, test:
  curl https://$YOLO_DOMAIN/api/ppe/status

Jika model custom belum ada, upload:
  deploy/google-cloud/upload-model.sh

EOF

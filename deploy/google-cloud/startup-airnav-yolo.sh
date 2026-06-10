#!/usr/bin/env bash
set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/iqbalusman/airnav-iot-dashboard.git}"
APP_DIR="${APP_DIR:-/opt/airnav-iot-dashboard}"
CAMERA_SOURCE="${CAMERA_SOURCE:-http://192.168.1.51/stream}"
YOLO_DOMAIN="${YOLO_DOMAIN:-}"
TAILSCALE_AUTH_KEY="${TAILSCALE_AUTH_KEY:-}"

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y \
  ca-certificates \
  curl \
  git \
  python3 \
  python3-venv \
  python3-pip \
  libgl1 \
  libglib2.0-0 \
  libsm6 \
  libxext6 \
  libxrender1 \
  ffmpeg

if ! command -v tailscale >/dev/null 2>&1; then
  curl -fsSL https://tailscale.com/install.sh | sh
fi

if [ -n "$TAILSCALE_AUTH_KEY" ]; then
  tailscale up --auth-key="$TAILSCALE_AUTH_KEY" --hostname=airnav-yolo-gce || true
fi

if [ ! -d "$APP_DIR/.git" ]; then
  rm -rf "$APP_DIR"
  git clone "$REPO_URL" "$APP_DIR"
else
  git -C "$APP_DIR" pull --ff-only
fi

cd "$APP_DIR"
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r yolo_backend/requirements.txt

mkdir -p models logs captures/violations

cat >/etc/systemd/system/airnav-yolo.service <<SERVICE
[Unit]
Description=AirNav YOLO Backend
After=network-online.target tailscaled.service
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$APP_DIR/.venv/bin/python yolo_backend/app.py --source $CAMERA_SOURCE --host 127.0.0.1 --port 5050
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
SERVICE

systemctl daemon-reload
systemctl enable airnav-yolo
systemctl restart airnav-yolo

if [ -n "$YOLO_DOMAIN" ]; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https gnupg
  if [ ! -f /usr/share/keyrings/caddy-stable-archive-keyring.gpg ]; then
    curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  fi
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy

  cat >/etc/caddy/Caddyfile <<CADDY
$YOLO_DOMAIN {
  reverse_proxy 127.0.0.1:5050
}
CADDY
  systemctl enable caddy
  systemctl reload caddy || systemctl restart caddy
fi

echo "AirNav YOLO backend setup selesai."

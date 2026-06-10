# Google Cloud Deployment Scripts

Folder ini berisi script untuk menjalankan backend YOLO di Google Compute Engine.

## 1. Install Google Cloud CLI

Di macOS:

```bash
brew install --cask google-cloud-sdk
gcloud init
gcloud auth login
```

## 2. Buat konfigurasi

```bash
cp deploy/google-cloud/env.example deploy/google-cloud/env.sh
```

Edit `deploy/google-cloud/env.sh`:

```bash
export PROJECT_ID="project-id-kamu"
export ZONE="asia-southeast2-a"
export REGION="asia-southeast2"
export VM_NAME="airnav-yolo-backend"
export CAMERA_SOURCE="http://192.168.1.51/stream"
export YOLO_DOMAIN="yolo.airnavgorontalo.com"
```

Jika memakai Tailscale auth key:

```bash
export TAILSCALE_AUTH_KEY="tskey-auth-..."
```

## 3. Buat VM Google Cloud

```bash
chmod +x deploy/google-cloud/*.sh
deploy/google-cloud/create-vm.sh
```

Script akan:

- reserve static IP,
- membuat firewall 80/443,
- membuat VM Ubuntu,
- install Python/backend dependencies,
- install Tailscale,
- install Caddy,
- membuat service `airnav-yolo`.

## 4. Arahkan DNS

Buat A record:

```text
yolo.airnavgorontalo.com -> EXTERNAL_IP_VM
```

## 5. Upload model custom

Model `models/best.pt` tidak ikut GitHub karena besar. Upload ke VM:

```bash
deploy/google-cloud/upload-model.sh
```

## 6. Test backend

```bash
curl https://yolo.airnavgorontalo.com/api/ppe/status
```

## 7. Setting dashboard Vercel

Di menu API:

```text
Backend YOLO URL: https://yolo.airnavgorontalo.com
API / IP Kamera : http://192.168.1.51/stream
```

## Catatan Kamera Lokal

VM Google Cloud hanya bisa membaca `192.168.1.51` jika jaringan lokal kamera sudah disambungkan ke VM melalui Tailscale/VPN/subnet router. Tanpa itu, Google Cloud tidak akan bisa mengakses kamera lokal.

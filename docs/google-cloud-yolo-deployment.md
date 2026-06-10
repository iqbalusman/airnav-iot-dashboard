# Deploy Backend YOLO ke Google Cloud

Panduan ini untuk menjalankan backend YOLO 24 jam di Google Cloud, sementara dashboard tetap di Vercel (`https://airnavgorontalo.com`).

## Arsitektur

```text
Dashboard Vercel
https://airnavgorontalo.com
        |
        | HTTPS
        v
Backend YOLO di Google Compute Engine
https://yolo.airnavgorontalo.com
        |
        | Tailscale / VPN
        v
Jaringan lokal kamera
ESP32-S3 Camera: http://192.168.1.51/stream
```

## Catatan Penting

Google Cloud tidak bisa langsung mengakses IP lokal seperti `192.168.1.51`. Agar backend di Google Cloud bisa membaca kamera, wajib ada salah satu dari ini di lokasi kamera:

- Router yang mendukung Tailscale/WireGuard/ZeroTier.
- Raspberry Pi atau mini PC kecil yang selalu menyala sebagai subnet router.
- PC lokal selalu menyala sebagai subnet router.

Kalau tidak ada perangkat lokal yang selalu menyala, kamera ESP32 harus diubah agar mengirim video keluar ke cloud. Dengan firmware sekarang, kamera hanya menyediakan URL lokal, jadi perlu VPN/tunnel.

## Rekomendasi VM Google Cloud

Untuk awal:

- Compute Engine VM
- OS: Ubuntu 22.04 LTS atau 24.04 LTS
- Machine type: `e2-standard-4` atau lebih tinggi
- Disk: minimal 30 GB
- Region dekat Indonesia, misalnya `asia-southeast2` jika tersedia untuk project

Jika FPS YOLO kurang, gunakan VM dengan GPU. Untuk tahap awal CPU VM cukup untuk validasi sistem.

## Setup Tailscale

### Di jaringan lokal kamera

Install Tailscale di perangkat lokal yang selalu menyala, lalu advertise subnet kamera:

```bash
sudo tailscale up --advertise-routes=192.168.1.0/24
```

Setelah itu buka Tailscale Admin Console dan approve route `192.168.1.0/24`.

### Di VM Google Cloud

Install Tailscale:

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

Test dari VM:

```bash
curl -I http://192.168.1.51/stream
curl -I http://192.168.1.51/capture
```

Jika berhasil, backend YOLO di VM bisa memakai:

```text
http://192.168.1.51/stream
```

## Setup Backend YOLO di VM

Clone repo:

```bash
git clone https://github.com/iqbalusman/airnav-iot-dashboard.git
cd airnav-iot-dashboard
```

Buat virtual environment:

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip
pip install -r yolo_backend/requirements.txt
```

Upload model custom ke:

```text
models/best.pt
```

Jalankan test:

```bash
.venv/bin/python yolo_backend/app.py \
  --source http://192.168.1.51/stream \
  --host 0.0.0.0 \
  --port 5050
```

Test dari VM:

```bash
curl http://127.0.0.1:5050/api/ppe/status
```

## Jalankan Otomatis dengan systemd

Buat file:

```bash
sudo nano /etc/systemd/system/airnav-yolo.service
```

Isi:

```ini
[Unit]
Description=AirNav YOLO Backend
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/home/USER/airnav-iot-dashboard
ExecStart=/home/USER/airnav-iot-dashboard/.venv/bin/python yolo_backend/app.py --source http://192.168.1.51/stream --host 127.0.0.1 --port 5050
Restart=always
RestartSec=5
Environment=PYTHONUNBUFFERED=1

[Install]
WantedBy=multi-user.target
```

Ganti `USER` sesuai user VM.

Aktifkan:

```bash
sudo systemctl daemon-reload
sudo systemctl enable airnav-yolo
sudo systemctl start airnav-yolo
sudo systemctl status airnav-yolo
```

Lihat log:

```bash
journalctl -u airnav-yolo -f
```

## HTTPS untuk Dashboard Vercel

Frontend Vercel sebaiknya mengakses backend melalui HTTPS, misalnya:

```text
https://yolo.airnavgorontalo.com
```

Cara termudah adalah pakai Caddy di VM.

Install Caddy:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy
```

Buat `/etc/caddy/Caddyfile`:

```caddy
yolo.airnavgorontalo.com {
  reverse_proxy 127.0.0.1:5050
}
```

Reload:

```bash
sudo systemctl reload caddy
```

Di Google Cloud firewall, buka port:

- TCP 80
- TCP 443

Port `5050` tidak perlu dibuka ke publik jika memakai Caddy.

## Setting Dashboard

Di menu API dashboard:

```text
Backend YOLO URL: https://yolo.airnavgorontalo.com
API / IP Kamera : http://192.168.1.51/stream
```

Tekan:

```text
Simpan IP Kamera
```

atau pilih mode:

```text
CCTV / YOLO
```

## Referensi Resmi

- Google Cloud Compute Engine: https://docs.cloud.google.com/compute/docs/instances/create-start-instance
- Google Cloud static external IP: https://docs.cloud.google.com/compute/docs/ip-addresses/configure-static-external-ip-address
- Google Cloud firewall rules: https://docs.cloud.google.com/firewall/docs/using-firewalls
- Tailscale di Google Compute Engine: https://tailscale.com/docs/install/cloud/gce

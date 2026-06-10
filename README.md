# AirNav IoT Dashboard + Deteksi YOLO APD

Proyek ini sudah ditambahkan section baru **Deteksi YOLO** untuk deteksi objek:

- `person`
- `helmet_airnav`
- `vest_airnav`

Sistem lama tetap ada:

- Dashboard utama
- Monitoring Suhu
- RFID
- ATS PLN/Generator
- Manajemen User
- API

Section baru menyesuaikan sistem dashboard yang sudah ada: login tetap menggunakan dashboard lama, sidebar lama tetap dipakai, dan menu baru muncul sebagai **Deteksi YOLO**.

---

## Login dashboard

```text
Username: admin
Password: admin123
```

---

## Cara jalan paling cepat di Cursor, pakai webcam laptop

1. Extract ZIP.
2. Buka folder proyek ini di Cursor.
3. Jalankan file:

```text
start_airnav_yolo_windows.bat
```

4. Buka browser:

```text
http://localhost:5173
```

5. Login:

```text
admin / admin123
```

6. Buka menu:

```text
Deteksi YOLO
```

Catatan: untuk uji awal, backend memakai webcam laptop dengan camera source `0`.

---

## Cara jalan dengan ESP32-S3 AI Camera

### 1. Upload firmware kamera

Buka folder:

```text
esp32/ESP32S3_AIRNAV_YOLO_CAMERA_STREAM
```

Edit WiFi di:

```text
include/config.h
```

Ubah:

```cpp
#define WIFI_SSID "ISI_NAMA_WIFI"
#define WIFI_PASSWORD "ISI_PASSWORD_WIFI"
```

Upload menggunakan PlatformIO di Cursor/VS Code.

Setelah upload, buka Serial Monitor. Akan tampil URL seperti:

```text
Stream YOLO : http://192.168.1.50:81/stream
```

### 2. Jalankan dashboard + YOLO backend

Dari folder utama proyek, jalankan:

```text
start_airnav_yolo_esp32_windows.bat
```

Masukkan URL stream ESP32-S3, contoh:

```text
http://192.168.1.50:81/stream
```

Buka:

```text
http://localhost:5173
```

---

## Struktur tambahan yang dibuat

```text
yolo_backend/
├── app.py                 # Backend Flask + OpenCV + YOLO
└── requirements.txt       # Dependency Python

models/
└── best.pt                # Taruh model hasil training di sini

training_yolo/
├── data.yaml              # Konfigurasi dataset YOLO
├── train.py               # Training YOLO
├── check_dataset.py       # Cek jumlah dataset
├── LABELING_GUIDE.md      # Panduan labeling
└── dataset/               # Folder gambar dan label

esp32/ESP32S3_AIRNAV_YOLO_CAMERA_STREAM/
├── platformio.ini
├── include/config.h
└── src/main.cpp
```

---

## Backend YOLO

Backend berjalan di:

```text
http://127.0.0.1:5050
```

Endpoint penting:

```text
/video_feed             # live stream hasil deteksi
/api/ppe/status         # status deteksi terbaru
/api/ppe/logs           # log deteksi
/logs/detections.csv    # file CSV log
```

---

## Training model helm dan rompi AirNav

Letakkan dataset YOLO ke:

```text
training_yolo/dataset/images/train
training_yolo/dataset/images/val
training_yolo/dataset/labels/train
training_yolo/dataset/labels/val
```

Nama kelas wajib:

```text
0 person
1 helmet_airnav
2 vest_airnav
```

Cek dataset:

```bash
python training_yolo/check_dataset.py
```

Training:

```bash
python training_yolo/train.py
```

Hasil training terbaik akan disalin ke:

```text
models/best.pt
```

Setelah `models/best.pt` ada, buka dashboard lagi. Section Deteksi YOLO akan otomatis memakai model custom tersebut.

---

## Catatan penting

Dashboard sudah siap jalan, tetapi deteksi helm/rompi AirNav yang akurat membutuhkan model custom `models/best.pt` dari foto AirNav sendiri. Jika model belum ada, backend tetap berjalan dalam mode demo YOLO, namun belum akurat untuk APD AirNav.

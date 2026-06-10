# ESP32-S3 AirNav YOLO Camera Stream

Firmware ini menjadikan ESP32-S3 AI Camera sebagai kamera streaming MJPEG untuk backend YOLO.

## Cara pakai

1. Buka folder ini di Cursor/VS Code.
2. Pastikan extension PlatformIO sudah terpasang.
3. Edit `include/config.h`:

```cpp
#define WIFI_SSID "nama_wifi"
#define WIFI_PASSWORD "password_wifi"
```

4. Pilih model kamera yang sesuai. Default disiapkan untuk XIAO ESP32S3 Sense:

```cpp
#define CAMERA_MODEL_XIAO_ESP32S3
```

5. Upload ke board.
6. Buka Serial Monitor. Ambil URL:

```text
http://IP-ESP32:81/stream
```

7. Jalankan `start_airnav_yolo_esp32_windows.bat` dari folder utama proyek, lalu masukkan URL tersebut.

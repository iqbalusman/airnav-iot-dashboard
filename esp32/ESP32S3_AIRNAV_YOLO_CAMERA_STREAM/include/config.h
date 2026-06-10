#pragma once

// ============================
// WIFI
// ============================
#define WIFI_SSID "ISI_NAMA_WIFI"
#define WIFI_PASSWORD "ISI_PASSWORD_WIFI"

// ============================
// PILIH MODEL KAMERA
// ============================
// Default: Seeed XIAO ESP32S3 Sense.
// Jika pin kamera tidak cocok, ganti ke salah satu opsi di bawah ini:
// #define CAMERA_MODEL_XIAO_ESP32S3
// #define CAMERA_MODEL_ESP32S3_EYE
// #define CAMERA_MODEL_AI_THINKER_ESP32_CAM
#define CAMERA_MODEL_XIAO_ESP32S3

// Resolusi tinggi yang lebih stabil untuk streaming YOLO.
// Jika board/PSRAM kuat, boleh dinaikkan ke FRAMESIZE_HD.
#define CAMERA_FRAME_SIZE FRAMESIZE_SVGA   // 800x600
#define CAMERA_JPEG_QUALITY 10             // lebih kecil = lebih jernih, 10 masih cukup ringan
#define CAMERA_FB_COUNT 2

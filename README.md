# Airnav IoT Monitoring Dashboard

Project React + Vite + Tailwind untuk dashboard monitoring IoT Airnav.

## Cara menjalankan di Cursor

1. Extract file ZIP ini.
2. Buka folder `airnav-iot-dashboard-cursor` di Cursor.
3. Buka terminal Cursor, lalu jalankan:

```bash
npm install
npm run dev
```

4. Buka URL yang muncul di terminal, biasanya:

```bash
http://localhost:5173
```

## Login demo

```txt
username: admin
password: admin123
```

## Fitur

- Landing page premium Airnav IoT Monitoring
- Login admin
- Register user baru dengan status pending
- Manajemen user: terima/tolak user
- Dashboard admin
- Monitoring suhu dan kelembaban
- Monitoring RFID alat
- Monitoring ATS PLN / Generator
- Mode data dummy dan API Google Apps Script
- Validasi agar aplikasi tetap jalan walau API belum diisi
- Recovery otomatis kalau data user di localStorage rusak

## Konfigurasi API

Masuk sebagai admin, buka menu `API`, lalu isi URL endpoint:

- API Suhu
- API RFID
- API ATS

Selama URL belum lengkap, aplikasi otomatis memakai data dummy.

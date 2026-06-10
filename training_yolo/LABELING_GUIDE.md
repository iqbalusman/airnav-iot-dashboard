# Panduan Labeling Dataset AirNav PPE

Gunakan 3 kelas YOLO berikut:

```text
0 person
1 helmet_airnav
2 vest_airnav
```

## Foto yang dibutuhkan

Ambil foto dalam kondisi:

- Memakai helm + rompi lengkap.
- Memakai helm saja.
- Memakai rompi saja.
- Tanpa helm dan tanpa rompi.
- Tampak depan, samping, jarak dekat, jarak sedang, dan pencahayaan berbeda.

## Struktur folder

```text
training_yolo/dataset/
├── images/
│   ├── train/
│   └── val/
└── labels/
    ├── train/
    └── val/
```

Setelah training selesai, file terbaik otomatis disalin ke:

```text
models/best.pt
```

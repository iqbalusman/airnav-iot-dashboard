from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "training_yolo" / "dataset"
folders = [
    DATASET / "images" / "train",
    DATASET / "images" / "val",
    DATASET / "labels" / "train",
    DATASET / "labels" / "val",
]

print("CEK DATASET YOLO AIRNAV")
print("=" * 34)
for folder in folders:
    folder.mkdir(parents=True, exist_ok=True)
    print(f"{folder.relative_to(ROOT)}: {len([p for p in folder.iterdir() if p.is_file()])} file")

print("\nKelas label:")
print("0 helmet_airnav")
print("1 vest_airnav")

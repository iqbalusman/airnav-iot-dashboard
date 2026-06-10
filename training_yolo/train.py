from pathlib import Path
from ultralytics import YOLO

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "training_yolo" / "data.yaml"
MODEL_DIR = ROOT / "models"
RUNS = ROOT / "runs"

if __name__ == "__main__":
    model = YOLO("yolo11n.pt")
    model.train(
        data=str(DATA),
        epochs=100,
        imgsz=320,
        batch=16,
        workers=2,
        project=str(RUNS),
        name="airnav_ppe_yolo",
        exist_ok=True,
    )
    best = RUNS / "airnav_ppe_yolo" / "weights" / "best.pt"
    MODEL_DIR.mkdir(exist_ok=True)
    if best.exists():
        target = MODEL_DIR / "best.pt"
        target.write_bytes(best.read_bytes())
        print(f"Model terbaik disalin ke: {target}")
    else:
        print("Training selesai, tetapi best.pt tidak ditemukan. Cek folder runs/.")

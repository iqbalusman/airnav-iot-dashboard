@echo off
cd /d %~dp0
if not exist yolo_backend\.venv (
  python -m venv yolo_backend\.venv
)
call yolo_backend\.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r yolo_backend\requirements.txt
python yolo_backend\app.py --source 0 --port 5050
pause

@echo off
cd /d %~dp0
set /p ESPURL=Masukkan URL stream ESP32-S3, contoh http://192.168.1.50:81/stream : 
if not exist yolo_backend\.venv (
  python -m venv yolo_backend\.venv
)
call yolo_backend\.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r yolo_backend\requirements.txt
python yolo_backend\app.py --source %ESPURL% --port 5050
pause

@echo off
cd /d %~dp0
set /p ESPURL=Masukkan URL stream ESP32-S3, contoh http://192.168.1.50:81/stream : 
if not exist yolo_backend\.venv (
  python -m venv yolo_backend\.venv
)
call yolo_backend\.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r yolo_backend\requirements.txt
if not exist node_modules (
  npm install
)
start "AirNav YOLO Backend ESP32" cmd /k "cd /d %~dp0 && call yolo_backend\.venv\Scripts\activate && python yolo_backend\app.py --source %ESPURL% --port 5050"
start "AirNav Dashboard React" cmd /k "cd /d %~dp0 && npm run dev"
echo.
echo Dashboard : http://localhost:5173
echo Backend   : http://127.0.0.1:5050/api/ppe/status
echo Source    : %ESPURL%
echo Login     : admin / admin123
echo.
pause

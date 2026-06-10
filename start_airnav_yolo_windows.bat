@echo off
cd /d %~dp0
if not exist yolo_backend\.venv (
  python -m venv yolo_backend\.venv
)
call yolo_backend\.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r yolo_backend\requirements.txt
if not exist node_modules (
  npm install
)
start "AirNav YOLO Backend" cmd /k "cd /d %~dp0 && call yolo_backend\.venv\Scripts\activate && python yolo_backend\app.py --source 0 --port 5050"
start "AirNav Dashboard React" cmd /k "cd /d %~dp0 && npm run dev"
echo.
echo ==============================================
echo AIRNAV IOT DASHBOARD + YOLO SIAP DIJALANKAN
echo ==============================================
echo Frontend : http://localhost:5173
echo Backend  : http://127.0.0.1:5050/api/ppe/status
echo Login    : admin / admin123
echo Menu     : Deteksi YOLO
echo.
pause

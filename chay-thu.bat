@echo off
REM Chay thu app tren may (can Python). Mo trinh duyet tai http://localhost:8000
cd /d "%~dp0"
start "" http://localhost:8000
python -m http.server 8000

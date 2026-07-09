@echo off
cd /d "%~dp0"
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8126" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>nul
start "Kingswood Hub Server" /min node ".preview-server.cjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:8126/index.html?section=dashboard&v=179"

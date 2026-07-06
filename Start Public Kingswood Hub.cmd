@echo off
cd /d "%~dp0"

title Kingswood Hub Public Testing URL
echo.
echo Kingswood Hub - Public Testing URL
echo =================================
echo.
echo This keeps the Hub running from this OneDrive computer and gives you
echo a temporary public URL for testing from home.
echo.
echo IMPORTANT:
echo - Keep this window open while testing.
echo - The URL changes each time unless we later set up a permanent tunnel.
echo - Data still saves in this OneDrive Hub folder.
echo.
echo Starting Kingswood Hub...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8126" ^| findstr "LISTENING"') do taskkill /PID %%a /F >nul 2>nul
start "Kingswood Hub Server" /min node ".preview-server.cjs"
timeout /t 2 /nobreak >nul

where cloudflared >nul 2>nul
if errorlevel 1 (
  echo.
  echo Cloudflare Tunnel is not installed on this computer yet, so I cannot create
  echo the public URL until that is installed.
  echo.
  echo Install Cloudflare Tunnel from:
  echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
  echo.
  echo Choose the Windows 64-bit download, install it, then double-click:
  echo Start Public Kingswood Hub.cmd
  echo.
  echo After installing cloudflared, run this file again.
  echo.
  pause
  exit /b 1
)

echo.
echo A public testing URL will appear below.
echo Keep this window open while testing from home.
echo Copy the https://...trycloudflare.com address into your laptop.
echo.
cloudflared tunnel --url http://127.0.0.1:8126

@echo off
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -File "%~dp0Apply Proofing Builder Updates.ps1"

@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_end_user.ps1"
if errorlevel 1 (
  echo.
  echo Installation failed.
  pause
  exit /b 1
)
echo.
echo Installation completed.
pause

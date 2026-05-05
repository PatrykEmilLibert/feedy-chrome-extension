@echo off
setlocal

echo Native permanent install for Chrome (policy-based)
set /p EXT_ID=Enter Chrome extension ID (32 chars, a-p): 
if "%EXT_ID%"=="" (
  echo Extension ID is required.
  pause
  exit /b 1
)

set /p SCOPE=Policy scope [CurrentUser/LocalMachine] (default CurrentUser): 
if "%SCOPE%"=="" set SCOPE=CurrentUser

set /p UPDATE_URL=Update URL (default https://clients2.google.com/service/update2/crx): 
if "%UPDATE_URL%"=="" set UPDATE_URL=https://clients2.google.com/service/update2/crx

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install_native_policy_windows.ps1" -ExtensionId "%EXT_ID%" -PolicyScope "%SCOPE%" -UpdateUrl "%UPDATE_URL%"
if errorlevel 1 (
  echo.
  echo Native install failed.
  pause
  exit /b 1
)

echo.
echo Native install configured.
pause

@echo off
setlocal

echo Native permanent uninstall for Chrome (policy-based)
set /p EXT_ID=Enter Chrome extension ID (32 chars, a-p): 
if "%EXT_ID%"=="" (
  echo Extension ID is required.
  pause
  exit /b 1
)

set /p SCOPE=Policy scope [CurrentUser/LocalMachine] (default CurrentUser): 
if "%SCOPE%"=="" set SCOPE=CurrentUser

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0uninstall_native_policy_windows.ps1" -ExtensionId "%EXT_ID%" -PolicyScope "%SCOPE%"
if errorlevel 1 (
  echo.
  echo Native uninstall failed.
  pause
  exit /b 1
)

echo.
echo Native uninstall configured.
pause

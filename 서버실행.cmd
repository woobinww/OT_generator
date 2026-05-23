@echo off
cd /d "%~dp0"

echo ==========================================
echo Radiology Work Attendance Server
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is not installed.
  echo Install Node.js 24 or newer, then run this file again.
  echo.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm is not installed or not available in PATH.
  echo Reinstall Node.js with npm included, then run this file again.
  echo.
  pause
  exit /b 1
)

echo Starting server...
echo.
echo Admin page:
echo   http://localhost:3000
echo.
echo User page:
echo   http://localhost:3000/user.html
echo.
echo From another PC or phone on the same network:
echo   http://THIS_PC_IP:3000
echo   http://THIS_PC_IP:3000/user.html
echo.
echo To stop the server, press Ctrl+C in this window.
echo.

npm start

echo.
echo Server stopped.
pause

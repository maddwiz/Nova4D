@echo off
setlocal

cd /d %~dp0\..

if not exist node_modules (
  echo [Nova4D] Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo [Nova4D] npm install failed.
    exit /b 1
  )
)

if "%NOVA4D_PORT%"=="" set NOVA4D_PORT=30010
echo [Nova4D] Starting bridge server on http://localhost:%NOVA4D_PORT%
call npm start

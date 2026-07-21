@echo off
setlocal enabledelayedexpansion
title Smart Shop Management System
color 0A

cd /d "%~dp0"

REM Ensure Node.js is available
where node >nul 2>nul
if errorlevel 1 (
    echo.
    echo  ERROR: Node.js is not installed or not in PATH.
    echo  Please install Node.js from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM Ensure dependencies are installed
if not exist "node_modules" (
    echo.
    echo  Installing dependencies...
    call npm install
    if errorlevel 1 (
        echo.
        echo  ERROR: Failed to install dependencies.
        pause
        exit /b 1
    )
)

echo.
echo  ============================================
echo     SMART SHOP MANAGEMENT SYSTEM
echo  ============================================
echo.
echo  Building Smart Shop...
echo  - App: http://localhost:5000
echo.
call npm run build
if errorlevel 1 (
    echo.
    echo  Build failed. Please fix the errors above and try again.
    pause
    exit /b 1
)

echo.
echo  ============================================
echo  Build successful!
echo  Starting Smart Shop Server...
echo  - Open http://localhost:5000 in your browser
echo  - Keep this window open while using the app.
echo  ============================================
echo.

REM Start server in new window and open browser
start "Smart Shop Server" cmd /k "cd /d "%~dp0" && npm run server"

echo Waiting for the app to start...
timeout /t 4 /nobreak >nul
start "" "http://localhost:5000"

echo.
echo Smart Shop is running at http://localhost:5000
echo Close the server window to stop the server.
echo.
pause
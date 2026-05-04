@echo off
setlocal enabledelayedexpansion

:: Check if wails3 is available
where wails3 >nul 2>&1
if %errorlevel% equ 0 (
    set WAILS_CMD=wails3
) else (
    set WAILS_CMD=%USERPROFILE%\go\bin\wails3.exe
)

:: Common build task for Windows
if "%1"=="clean" (
    echo Cleaning build artifacts...
    if exist build\bin rmdir /s /q build\bin
    if exist frontend\dist rmdir /s /q frontend\dist
    echo Clean complete.
    exit /b 0
)

if "%1"=="dev" (
    echo Starting development server...
    call %WAILS_CMD% dev
    exit /b %errorlevel%
)

:: Default: Build current platform
echo Building Angular frontend...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo Frontend build failed
    cd ..
    exit /b 1
)
cd ..

echo Building cupcake for Windows...
if not exist build\bin mkdir build\bin
go build -ldflags="-s -w -H windowsgui" -o build\bin\cupcake.exe
if %errorlevel% neq 0 (
    echo Go build failed
    exit /b 1
)

echo Build complete: build\bin\cupcake.exe
exit /b 0

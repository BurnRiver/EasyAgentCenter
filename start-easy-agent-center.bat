@echo off
setlocal

cd /d "%~dp0"

if /i "%~1"=="--run" (
    set "HIDDEN_LAUNCH=1"
    set "LAUNCH_MODE=app"
    goto launch
)

if /i "%~1"=="--visible" (
    set "HIDDEN_LAUNCH=0"
    set "LAUNCH_MODE=app"
    goto launch
)

if /i "%~1"=="--dev" (
    set "HIDDEN_LAUNCH=0"
    set "LAUNCH_MODE=dev"
    goto launch
)

if /i "%~1"=="--dev-hidden" (
    set "HIDDEN_LAUNCH=1"
    set "LAUNCH_MODE=dev"
    goto launch
)

set "HIDDEN_LAUNCH=0"
set "LAUNCH_MODE=app"
goto launch

:launch
if /i "%LAUNCH_MODE%"=="dev" goto launch_dev

set "APP_EXE=%~dp0dist\win-unpacked\easy-agent-center.exe"
if not exist "%APP_EXE%" set "APP_EXE=%~dp0easy-agent-center.exe"

if exist "%APP_EXE%" (
    echo Starting EasyAgentCenter...
    start "" "%APP_EXE%"
    exit /b 0
)

echo [WARN] Packaged app not found. Falling back to development mode.

:launch_dev
if not exist "package.json" (
    echo [ERROR] package.json not found in %cd%
    echo Make sure you are running this script from the EasyAgentCenter project root.
    if "%HIDDEN_LAUNCH%"=="0" pause
    exit /b 1
)

if not exist "node_modules" (
    echo [ERROR] node_modules not found.
    echo Please run "npm ci" first to install dependencies.
    if "%HIDDEN_LAUNCH%"=="0" pause
    exit /b 1
)

where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found in PATH.
    echo Please install Node.js 24.14.0 or the version in .node-version from https://nodejs.org/
    if "%HIDDEN_LAUNCH%"=="0" pause
    exit /b 1
)

echo Starting EasyAgentCenter...
echo.
npm run dev

if errorlevel 1 (
    echo.
    echo [ERROR] EasyAgentCenter exited with an error.
    if "%HIDDEN_LAUNCH%"=="0" pause
)

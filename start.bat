@echo off
REM ============================================================================
REM SC2 Build Lab - Auto-Start Script (Windows)
REM Checks dependencies and launches the application
REM ============================================================================

setlocal enabledelayedexpansion

set "APP_DIR=%~dp0"
set "DEFAULT_PORT=8080"
set "DATA_FILE=sc2units.json"

REM Colors using PowerShell
set "COLOR_RESET=[0m"
set "COLOR_RED=[91m"
set "COLOR_GREEN=[92m"
set "COLOR_YELLOW=[93m"
set "COLOR_BLUE=[94m"
set "COLOR_CYAN=[96m"

:MAIN
call :PRINT_HEADER
echo.
echo Working directory: %APP_DIR%
echo.

call :CHECK_DATA_FILE
echo.

REM ============================================================================
REM Dependency Check
REM ============================================================================
echo ================================================================
echo Dependency Check
echo ================================================================
echo.

set "SERVER_METHOD="

REM Check for http-server
where http-server >nul 2>&1
if %errorlevel% equ 0 (
    echo [92m✓[0m http-server found
    set "SERVER_METHOD=http-server"
    goto :START_SERVER
)

REM Check for serve
where serve >nul 2>&1
if %errorlevel% equ 0 (
    echo [92m✓[0m serve found
    set "SERVER_METHOD=serve"
    goto :START_SERVER
)

REM Check for Node.js and npm
where node >nul 2>&1
if %errorlevel% equ 0 (
    where npm >nul 2>&1
    if %errorlevel% equ 0 (
        echo [92m✓[0m Node.js and npm found
        echo [93m⚠[0m No development server found
        echo.
        echo Installing http-server...
        call :INSTALL_HTTP_SERVER
        if %errorlevel% equ 0 (
            set "SERVER_METHOD=http-server"
            goto :START_SERVER
        )
    )
)

REM Check for Python
where python >nul 2>&1
if %errorlevel% equ 0 (
    echo [92m✓[0m Python found
    set "SERVER_METHOD=python"
    goto :START_SERVER
)

REM No server found
echo [91m✗[0m No suitable development server found!
echo.
echo Please install one of the following:
echo   • Node.js + http-server:  npm install -g http-server
echo   • Node.js + serve:        npm install -g serve
echo   • Python 3:               https://www.python.org/downloads/
echo.
pause
exit /b 1

:START_SERVER
echo.
echo ================================================================
echo Starting Server
echo ================================================================
echo.

if "%SERVER_METHOD%"=="http-server" (
    call :START_HTTP_SERVER
) else if "%SERVER_METHOD%"=="serve" (
    call :START_SERVE
) else if "%SERVER_METHOD%"=="python" (
    call :START_PYTHON
)

goto :EOF

REM ============================================================================
REM Helper Functions
REM ============================================================================

:PRINT_HEADER
echo [96m╔════════════════════════════════════════════════════════════════╗[0m
echo [96m║                    SC2 Build Lab Launcher                      ║[0m
echo [96m║          StarCraft II Build Order Analysis Tool                ║[0m
echo [96m╚════════════════════════════════════════════════════════════════╝[0m
goto :EOF

:CHECK_DATA_FILE
if exist "%APP_DIR%%DATA_FILE%" (
    echo [92m✓[0m Game data found: %DATA_FILE%
) else (
    echo [93m⚠[0m Game data file not found: %DATA_FILE%
    echo [94mℹ[0m The app will work, but you'll need to load sc2units.json manually
    echo [94mℹ[0m You can drag-and-drop the JSON file into the browser
)
goto :EOF

:INSTALL_HTTP_SERVER
echo Installing http-server globally...
call npm install -g http-server
exit /b %errorlevel%

:START_HTTP_SERVER
echo [96m▶[0m Starting http-server on port %DEFAULT_PORT%...
echo [94mℹ[0m Server URL: http://localhost:%DEFAULT_PORT%
echo [94mℹ[0m Press Ctrl+C to stop the server
echo.
cd /d "%APP_DIR%"
start http://localhost:%DEFAULT_PORT%
http-server . -p %DEFAULT_PORT% -c-1 --cors
goto :EOF

:START_SERVE
echo [96m▶[0m Starting serve on port %DEFAULT_PORT%...
echo [94mℹ[0m Server URL: http://localhost:%DEFAULT_PORT%
echo [94mℹ[0m Press Ctrl+C to stop the server
echo.
cd /d "%APP_DIR%"
start http://localhost:%DEFAULT_PORT%
serve . -l %DEFAULT_PORT% --cors
goto :EOF

:START_PYTHON
echo [96m▶[0m Starting Python HTTP server on port %DEFAULT_PORT%...
echo [94mℹ[0m Server URL: http://localhost:%DEFAULT_PORT%
echo [94mℹ[0m Press Ctrl+C to stop the server
echo.
cd /d "%APP_DIR%"
start http://localhost:%DEFAULT_PORT%
python -m http.server %DEFAULT_PORT%
goto :EOF

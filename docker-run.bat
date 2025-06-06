@echo off
REM Synth-Dev Docker Management Script for Windows
REM This script provides easy commands to manage the Synth-Dev Docker setup

setlocal enabledelayedexpansion

REM Check if Docker is running
docker info >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Docker is not running. Please start Docker first.
    exit /b 1
)

REM Function to check if .env file exists
if not exist ".env" (
    echo [WARNING] .env file not found!
    echo [INFO] Creating .env from config.example.env...
    copy config.example.env .env >nul
    echo [WARNING] Please edit .env file with your API keys before running the application
    if "%1"=="setup" goto :setup_complete
    if "%1"=="" goto :show_usage
    exit /b 1
)

REM Parse command line arguments
set COMMAND=%1
set CUSTOM_PATH=
set MOUNT_PATH=%cd%

REM Check for --path parameter
:parse_args
if "%2"=="" goto :after_parse
if "%2"=="--path" (
    set CUSTOM_PATH=%3
    set MOUNT_PATH=%3
    shift
    shift
    goto :parse_args
)
shift
goto :parse_args

:after_parse
REM Validate custom path if provided
if not "%CUSTOM_PATH%"=="" (
    if not exist "%CUSTOM_PATH%" (
        echo [ERROR] Path does not exist: %CUSTOM_PATH%
        exit /b 1
    )
    echo [INFO] Using custom working directory: %CUSTOM_PATH%
)

REM Main script logic
if "%COMMAND%"=="setup" goto :setup
if "%COMMAND%"=="start" goto :start
if "%COMMAND%"=="run" goto :run
if "%COMMAND%"=="dev" goto :dev
if "%COMMAND%"=="stop" goto :stop
if "%COMMAND%"=="restart" goto :restart
if "%COMMAND%"=="build" goto :build
if "%COMMAND%"=="logs" goto :logs
if "%COMMAND%"=="shell" goto :shell
if "%COMMAND%"=="clean" goto :clean
if "%COMMAND%"=="status" goto :status
if "%COMMAND%"=="help" goto :show_usage
goto :show_usage

:setup
echo [INFO] Setting up Synth-Dev Docker environment...
if not exist ".env" (
    copy config.example.env .env >nul
    echo [SUCCESS] .env file created from config.example.env
    echo [WARNING] Please edit .env file with your API keys:
    echo [INFO] notepad .env
) else (
    echo [WARNING] .env file already exists
)
:setup_complete
echo [INFO] Building Docker image...
docker-compose build
echo [SUCCESS] Setup complete! Run '%0 start' to start the application
goto :end

:start
echo [INFO] Starting Synth-Dev in production mode...
echo [INFO] This will start an interactive console application.
echo [INFO] You can type commands and interact with the AI assistant.
if not "%CUSTOM_PATH%"=="" (
    echo [INFO] Working directory: %CUSTOM_PATH%
    echo [WARNING] Custom path mounting not supported with docker-compose start.
    echo [INFO] Use '%0 run --path "%CUSTOM_PATH%"' for custom path support.
) else (
    echo [INFO] Working directory: %cd%
)
echo [INFO] Press Ctrl+C to stop the application.
echo.
docker-compose up --build
goto :end

:run
echo [INFO] Running Synth-Dev interactively...
echo [INFO] This provides the best interactive experience.
echo [INFO] You can type commands and interact with the AI assistant.
if not "%CUSTOM_PATH%"=="" (
    echo [INFO] Working directory: %CUSTOM_PATH%
    echo [INFO] Synth-Dev will run as global CLI tool from this directory
) else (
    echo [INFO] Working directory: %cd%
    echo [INFO] Running from Synth-Dev source directory
)
echo [INFO] Press Ctrl+C to stop the application.
echo.
REM Build the image first
docker-compose build
REM Run with full interactive support
if not "%CUSTOM_PATH%"=="" (
    REM Mount custom path as working directory and run global synth-dev
    docker run -it --rm --name synth-dev-interactive ^
      --env-file .env ^
      -v "%CUSTOM_PATH%":/workspace ^
      -w /workspace ^
      synth-dev-synth-dev synth-dev
) else (
    REM Standard run from source directory
    docker run -it --rm --name synth-dev-interactive ^
      --env-file .env ^
      -v "%cd%":/app ^
      -v /app/node_modules ^
      -w /app ^
      synth-dev-synth-dev npm start
)
goto :end

:dev
echo [INFO] Starting Synth-Dev in development mode...
echo [INFO] This will start an interactive console application with hot reload.
echo [INFO] You can type commands and interact with the AI assistant.
echo [INFO] Press Ctrl+C to stop the application.
echo.
docker-compose --profile dev up --build synth-dev-dev
goto :end

:stop
echo [INFO] Stopping Synth-Dev...
docker-compose down
echo [SUCCESS] Application stopped
goto :end

:restart
echo [INFO] Restarting Synth-Dev...
docker-compose restart
echo [SUCCESS] Application restarted
goto :end

:build
echo [INFO] Building Docker image...
docker-compose build --no-cache
echo [SUCCESS] Image built successfully
goto :end

:logs
echo [INFO] Showing application logs...
docker-compose logs -f
goto :end

:shell
echo [INFO] Opening shell in container...
docker-compose ps | findstr "synth-dev-app.*Up" >nul
if not errorlevel 1 (
    docker-compose exec synth-dev sh
) else (
    docker-compose ps | findstr "synth-dev-dev.*Up" >nul
    if not errorlevel 1 (
        docker-compose exec synth-dev-dev sh
    ) else (
        echo [ERROR] No running container found. Start the application first.
        exit /b 1
    )
)
goto :end

:clean
echo [INFO] Cleaning up Docker resources...
echo [WARNING] This will remove containers, networks, and volumes!
set /p confirm="Are you sure? (y/N): "
if /i "!confirm!"=="y" (
    docker-compose down -v --rmi local
    echo [SUCCESS] Cleanup complete
) else (
    echo [INFO] Cleanup cancelled
)
goto :end

:status
echo [INFO] Container status:
docker-compose ps
goto :end

:show_usage
echo Synth-Dev Docker Management Script
echo.
echo Usage: %0 [COMMAND] [OPTIONS]
echo.
echo Commands:
echo   setup       Initial setup (create .env file)
echo   start       Start the application in production mode
echo   run         Run interactively (RECOMMENDED for best user input experience)
echo   dev         Start the application in development mode
echo   stop        Stop the application
echo   restart     Restart the application
echo   build       Build the Docker image
echo   logs        Show application logs
echo   shell       Open shell in the container
echo   clean       Stop and remove containers, networks, and volumes
echo   status      Show container status
echo   help        Show this help message
echo.
echo Options:
echo   --path PATH Mount a custom directory as working directory (only with 'run' command)
echo               Synth-Dev runs as global CLI tool from the specified directory
echo               Environment variables from .env are automatically loaded
echo.
echo Examples:
echo   %0 setup                                    # First time setup
echo   %0 run                                      # Run interactively (RECOMMENDED)
echo   %0 run --path "C:\path\to\your\project"     # Run Synth-Dev from your project directory
echo   %0 start                                    # Start in production mode
echo   %0 dev                                      # Start in development mode
echo   %0 logs                                     # View logs
echo   %0 clean                                    # Clean up everything

:end
endlocal

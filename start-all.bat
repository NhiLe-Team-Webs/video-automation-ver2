@echo off
echo ========================================
echo   YouTube Video Automation Pipeline
echo ========================================
echo.

echo [1/5] Checking Redis...
redis-cli ping >nul 2>&1
if %errorlevel% neq 0 (
    echo Redis is not running. Starting Redis with Docker...
    start "Redis Server" docker run --rm -p 6379:6379 redis:7-alpine
    timeout /t 3 >nul
) else (
    echo Redis is already running!
)

echo.
echo [2/5] Building project...
call npm run build
if %errorlevel% neq 0 (
    echo Build failed! Please check errors above.
    pause
    exit /b 1
)

echo.
echo [3/5] Starting API Server...
start "API Server" cmd /k "npm run dev"
timeout /t 5 >nul

echo.
echo [4/5] Starting Worker...
start "Worker" cmd /k "npm run worker"
timeout /t 3 >nul

echo.
echo [5/5] Opening Web Interface...
timeout /t 2 >nul
start http://localhost:3000/upload.html

echo.
echo ========================================
echo   All Services Started Successfully!
echo ========================================
echo.
echo Access Points:
echo   - Upload Video: http://localhost:3000/upload.html
echo   - Preview: http://localhost:3000/preview.html
echo   - API: http://localhost:3000/api
echo.
echo Logs Location:
echo   - All logs: logs\combined.log
echo   - Errors: logs\error.log
echo.
echo Data Storage (in project):
echo   - Uploads: temp\uploads\
echo   - Final videos: temp\final-videos\
echo   - Cache: cache\broll\
echo.
echo Press any key to view logs...
pause >nul

echo.
echo Opening logs...
start notepad logs\combined.log

echo.
echo Pipeline is running!
echo Close the terminal windows to stop services.
pause

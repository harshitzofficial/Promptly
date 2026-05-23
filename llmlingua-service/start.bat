@echo off
echo ============================================
echo   Prompt Shaper — LLMLingua AI Worker
echo ============================================
echo.

:: Check Python is installed
python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python is not installed or not in PATH.
    echo Download it from https://python.org
    pause
    exit /b 1
)

:: Go to the script's directory
cd /d "%~dp0"

:: Install dependencies if not already installed
echo [1/2] Installing dependencies (only needed on first run)...
pip install -r requirements.txt -q

echo.
echo [2/2] Starting LLMLingua Worker on http://localhost:3006
echo        (First run will download ~400MB model from HuggingFace)
echo        Press Ctrl+C to stop.
echo.

python main.py
pause

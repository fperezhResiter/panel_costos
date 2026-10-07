@echo off
title Actualizar Panel Costos Resiter

cd /d "%~dp0"

echo ==========================================
echo   ACTUALIZANDO PANEL DE COSTOS RESITER
echo ==========================================
echo.

REM Verificar Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python no esta instalado o no esta en el PATH.
    echo Instale Python 3 y vuelva a intentarlo.
    pause
    exit /b 1
)

echo Verificando dependencias...

python -c "import openpyxl" >nul 2>&1
if errorlevel 1 (
    python -m pip install openpyxl
)

python -c "import cryptography" >nul 2>&1
if errorlevel 1 (
    python -m pip install cryptography
)

echo.
echo Ejecutando actualizacion...
echo.

python motor\real.py

echo.
echo ==========================================
echo Actualizacion finalizada
echo ==========================================
echo.

pause
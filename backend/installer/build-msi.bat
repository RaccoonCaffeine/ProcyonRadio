@echo off
REM Build script for ProcyonRadio MSI installer

setlocal enabledelayedexpansion

REM Detectar la ruta de WiX
set "WIX_PATH=C:\Program Files (x86)\WiX Toolset v3.14\bin"

if not exist "%WIX_PATH%\candle.exe" (
    echo Error: WiX Toolset no encontrado en %WIX_PATH%
    echo Descarga WiX desde: https://github.com/wixtoolset/wix3/releases
    exit /b 1
)

echo ========================================
echo Building ProcyonRadio Installer MSI
echo ========================================
echo.

REM Ruta de origen de los archivos
set "SOURCE_DIR=%~dp0..\dist\package"

if not exist "%SOURCE_DIR%\ProcyonRadio.exe" (
    echo Error: ProcyonRadio.exe no encontrado en %SOURCE_DIR%
    exit /b 1
)

if not exist "%SOURCE_DIR%\ffmpeg.exe" (
    echo Error: ffmpeg.exe no encontrado en %SOURCE_DIR%
    exit /b 1
)

if not exist "%SOURCE_DIR%\yt-dlp.exe" (
    echo Error: yt-dlp.exe no encontrado en %SOURCE_DIR%
    exit /b 1
)

echo Source files found:
echo  - ProcyonRadio.exe
echo  - ffmpeg.exe
echo  - yt-dlp.exe
echo.

REM Compilar
echo Compilando...
"%WIX_PATH%\candle.exe" Product.wxs -out obj\ -dSourceDir="%SOURCE_DIR%"
if errorlevel 1 (
    echo Error durante la compilacion
    exit /b 1
)

echo Enlazando...
"%WIX_PATH%\light.exe" -out ProcyonRadio-Installer.msi obj\Product.wixobj -ext WixUIExtension
if errorlevel 1 (
    echo Error durante el enlace
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS: Instalador creado
echo ========================================
echo Archivo: ProcyonRadio-Installer.msi
echo Ubicacion: %cd%
echo.
pause

@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ╔════════════════════════════════════════════════╗
echo ║          ProcyonRadio - Instalador              ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Definir carpeta de instalación
set "INSTALL_PATH=%ProgramFiles%\ProcyonRadio"

REM Si está en Descargas, instalar en carpeta local
if exist "ProcyonRadio.exe" (
    set "INSTALL_PATH=%CD%\ProcyonRadio"
)

echo 📁 Carpeta de instalación: %INSTALL_PATH%
echo.

REM Crear carpeta
if not exist "!INSTALL_PATH!" mkdir "!INSTALL_PATH!"

echo 📋 Copiando archivos...

REM Buscar archivos en la carpeta actual o en la carpeta padre
set "SOURCE_DIR=%CD%"
if not exist "!SOURCE_DIR!\ProcyonRadio.exe" (
    set "SOURCE_DIR=%CD%\.."
)

REM Copiar ejecutables
for %%F in (ProcyonRadio.exe ffmpeg.exe yt-dlp.exe) do (
    if exist "!SOURCE_DIR!\%%F" (
        copy /Y "!SOURCE_DIR!\%%F" "!INSTALL_PATH!\%%F" >nul
        echo   ✓ %%F
    ) else (
        echo   ✗ %%F NO ENCONTRADO
    )
)

echo.

REM Crear accesos directos
echo 🔗 Creando accesos directos...

REM Escritorio
set "DESKTOP=%USERPROFILE%\Desktop"
if exist "!DESKTOP!" (
    powershell -NoProfile -Command ^
        "$shell = New-Object -ComObject WScript.Shell; " ^
        "$lnk = $shell.CreateShortcut('!DESKTOP!\ProcyonRadio.lnk'); " ^
        "$lnk.TargetPath = '!INSTALL_PATH!\ProcyonRadio.exe'; " ^
        "$lnk.WorkingDirectory = '!INSTALL_PATH!'; " ^
        "$lnk.Save()" 2>nul
    echo   ✓ Acceso directo en el Escritorio
)

REM Menú Inicio
set "START_MENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\ProcyonRadio"
if not exist "!START_MENU!" mkdir "!START_MENU!"
if exist "!START_MENU!" (
    powershell -NoProfile -Command ^
        "$shell = New-Object -ComObject WScript.Shell; " ^
        "$lnk = $shell.CreateShortcut('!START_MENU!\ProcyonRadio.lnk'); " ^
        "$lnk.TargetPath = '!INSTALL_PATH!\ProcyonRadio.exe'; " ^
        "$lnk.WorkingDirectory = '!INSTALL_PATH!'; " ^
        "$lnk.Save()" 2>nul
    echo   ✓ Acceso directo en Menú Inicio
)

echo.
echo ✅ ¡INSTALACIÓN COMPLETADA!
echo.
echo 📌 Ahora puedes:
echo   • Hacer doble clic en ProcyonRadio.exe
echo   • O usar el acceso directo del Escritorio
echo   • O buscar "ProcyonRadio" en el Menú Inicio
echo.
pause

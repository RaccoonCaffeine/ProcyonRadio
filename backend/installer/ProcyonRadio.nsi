; ProcyonRadio Installer Script for NSIS
; This script creates a professional Windows installer

!include "MUI2.nsh"

; Configuración básica
Name "ProcyonRadio"
OutFile "ProcyonRadio-Instalador.exe"
InstallDir "$PROGRAMFILES\ProcyonRadio"
InstallDirRegKey HKCU "Software\ProcyonRadio" ""

; Solicitar permisos de administrador
RequestExecutionLevel admin

; MUI Icon Configurations (must be defined before pages)
!define MUI_ICON "..\..\logo_dark.ico"
!define MUI_UNICON "..\..\logo_dark.ico"

; MUI Settings / Pages
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES

# Finish page options (run the app when finished)
!define MUI_FINISHPAGE_RUN "$INSTDIR\ProcyonRadio.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Ejecutar ProcyonRadio ahora"
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_LANGUAGE "Spanish"
!insertmacro MUI_LANGUAGE "English"

; Función de instalación
Section "Install"
  SetOutPath "$INSTDIR"
  
  ; Copiar archivos ejecutables
  File "..\dist\package\ProcyonRadio.exe"
  File "..\dist\package\ffmpeg.exe"
  File "..\dist\package\yt-dlp.exe"
  File "..\dist\package\cloudflared.exe"
  File "..\dist\package\logo.ico"
  File "..\dist\package\logo_dark.ico"
  File "..\dist\package\logo_light.ico"
  
  ; Crear carpeta de datos
  CreateDirectory "$INSTDIR\data"
  SetOutPath "$INSTDIR\data"
  File "..\dist\package\data\fallback.mp3"
  File "..\dist\package\data\fondo.jpg"
  
  ; Crear accesos directos en Menú Inicio con icono personalizado
  CreateDirectory "$SMPROGRAMS\ProcyonRadio"
  CreateShortcut "$SMPROGRAMS\ProcyonRadio\ProcyonRadio.lnk" "$INSTDIR\ProcyonRadio.exe" "" "$INSTDIR\logo_dark.ico"
  CreateShortcut "$SMPROGRAMS\ProcyonRadio\Desinstalar.lnk" "$INSTDIR\uninstall.exe" "" "$INSTDIR\logo_dark.ico"
  
  ; Crear acceso directo en Escritorio con icono personalizado
  CreateShortcut "$DESKTOP\ProcyonRadio.lnk" "$INSTDIR\ProcyonRadio.exe" "" "$INSTDIR\logo_dark.ico"
  
  ; Guardar información de instalación
  WriteRegStr HKCU "Software\ProcyonRadio" "" "$INSTDIR"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProcyonRadio" "DisplayName" "ProcyonRadio"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProcyonRadio" "UninstallString" "$INSTDIR\uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProcyonRadio" "InstallLocation" "$INSTDIR"
  
  ; Crear desinstalador
  WriteUninstaller "$INSTDIR\uninstall.exe"
SectionEnd

; Función de desinstalación
Section "Uninstall"
  ; Eliminar archivos del programa
  Delete "$INSTDIR\ProcyonRadio.exe"
  Delete "$INSTDIR\ffmpeg.exe"
  Delete "$INSTDIR\yt-dlp.exe"
  Delete "$INSTDIR\cloudflared.exe"
  Delete "$INSTDIR\logo.ico"
  Delete "$INSTDIR\logo_dark.ico"
  Delete "$INSTDIR\logo_light.ico"
  Delete "$INSTDIR\uninstall.exe"
  
  ; Eliminar archivos de datos
  Delete "$INSTDIR\data\fallback.mp3"
  Delete "$INSTDIR\data\fondo.jpg"
  Delete "$INSTDIR\data\settings.json"
  Delete "$INSTDIR\data\users.json"
  Delete "$INSTDIR\data\license.json"
  Delete "$INSTDIR\data\sessions.json"
  
  ; Eliminar carpetas
  RMDir "$INSTDIR\data"
  RMDir "$INSTDIR"
  
  ; Eliminar accesos directos
  Delete "$SMPROGRAMS\ProcyonRadio\*.*"
  RMDir "$SMPROGRAMS\ProcyonRadio"
  Delete "$DESKTOP\ProcyonRadio.lnk"
  
  ; Eliminar registros
  DeleteRegKey HKCU "Software\ProcyonRadio"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProcyonRadio"
SectionEnd

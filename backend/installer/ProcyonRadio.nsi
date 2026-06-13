; ProcyonRadio Installer Script for NSIS
; This script creates a professional Windows installer

!include "MUI2.nsh"

; Configuración básica
Name "ProcyonRadio"
OutFile "ProcyonRadio-Installer.exe"
InstallDir "$PROGRAMFILES\ProcyonRadio"
InstallDirRegKey HKCU "Software\ProcyonRadio" ""

; Solicitar permisos de administrador
RequestExecutionLevel admin

; MUI Settings
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
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
  
  ; Crear carpeta de datos si no existe
  CreateDirectory "$INSTDIR\data"
  
  ; Crear accesos directos en Menú Inicio
  CreateDirectory "$SMPROGRAMS\ProcyonRadio"
  CreateShortcut "$SMPROGRAMS\ProcyonRadio\ProcyonRadio.lnk" "$INSTDIR\ProcyonRadio.exe"
  CreateShortcut "$SMPROGRAMS\ProcyonRadio\Desinstalar.lnk" "$INSTDIR\uninstall.exe"
  
  ; Crear acceso directo en Escritorio
  CreateShortcut "$DESKTOP\ProcyonRadio.lnk" "$INSTDIR\ProcyonRadio.exe"
  
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
  ; Eliminar archivos
  Delete "$INSTDIR\ProcyonRadio.exe"
  Delete "$INSTDIR\ffmpeg.exe"
  Delete "$INSTDIR\yt-dlp.exe"
  Delete "$INSTDIR\uninstall.exe"
  
  ; Eliminar carpetas
  RMDir /r "$INSTDIR\data"
  RMDir "$INSTDIR"
  
  ; Eliminar accesos directos
  Delete "$SMPROGRAMS\ProcyonRadio\*.*"
  RMDir "$SMPROGRAMS\ProcyonRadio"
  Delete "$DESKTOP\ProcyonRadio.lnk"
  
  ; Eliminar registro
  DeleteRegKey HKCU "Software\ProcyonRadio"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\ProcyonRadio"
SectionEnd

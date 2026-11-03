; Installateur Windows de VNL-SAD (Windows 10 et 11, 64 bits).
; Installation pour l'utilisateur courant, sans droits d'administrateur :
; raccourcis Menu Démarrer et Bureau, entrée dans « Applications et fonctionnalités ».
; Construction : makensis -DVERSION=2.1 windows/installer.nsi (après windows/build.sh)

Unicode true
!ifndef VERSION
  !define VERSION "2.1"
!endif
!define APP "VNL-SAD"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\VNL-SAD"

Name "${APP} ${VERSION}"
OutFile "VNL-SAD-Installation.exe"
InstallDir "$LOCALAPPDATA\Programs\VNL-SAD"
InstallDirRegKey HKCU "Software\VNL-SAD" "InstallDir"
RequestExecutionLevel user
SetCompressor /SOLID lzma
Icon "icon.ico"
UninstallIcon "icon.ico"
BrandingText "VNL-SAD · GAANA"
VIProductVersion "${VERSION}.0.0"
VIAddVersionKey /LANG=1036 "ProductName" "VNL-SAD"
VIAddVersionKey /LANG=1036 "FileDescription" "Installation de VNL-SAD"
VIAddVersionKey /LANG=1036 "CompanyName" "GAANA SPRL"
VIAddVersionKey /LANG=1036 "LegalCopyright" "G. Mukenga Kantambwa, 2026"
VIAddVersionKey /LANG=1036 "FileVersion" "${VERSION}"
VIAddVersionKey /LANG=1036 "ProductVersion" "${VERSION}"

!include "MUI2.nsh"
!define MUI_ICON "icon.ico"
!define MUI_UNICON "icon.ico"
!define MUI_WELCOMEPAGE_TITLE "Installation de VNL-SAD ${VERSION}"
!define MUI_WELCOMEPAGE_TEXT "VNL-SAD est le système d'aide à la décision sur la valeur nette logistique de la GAANA.$\r$\n$\r$\nLe logiciel fonctionne sans connexion Internet et garde les données sur cet ordinateur. Une version déjà installée est remplacée ; ses données sont conservées."
!define MUI_FINISHPAGE_RUN "$INSTDIR\VNL-SAD.exe"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer VNL-SAD maintenant"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "French"

Section "VNL-SAD"
  ; Ferme une instance en cours pour pouvoir remplacer le programme.
  nsExec::Exec 'taskkill /F /IM VNL-SAD.exe'
  SetOutPath "$INSTDIR"
  File "VNL-SAD.exe"
  File "icon.ico"
  WriteUninstaller "$INSTDIR\Desinstaller.exe"
  CreateDirectory "$SMPROGRAMS\VNL-SAD"
  CreateShortcut "$SMPROGRAMS\VNL-SAD\VNL-SAD.lnk" "$INSTDIR\VNL-SAD.exe" "" "$INSTDIR\icon.ico"
  CreateShortcut "$SMPROGRAMS\VNL-SAD\Désinstaller VNL-SAD.lnk" "$INSTDIR\Desinstaller.exe"
  CreateShortcut "$DESKTOP\VNL-SAD.lnk" "$INSTDIR\VNL-SAD.exe" "" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "Software\VNL-SAD" "InstallDir" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "VNL-SAD (valeur nette logistique)"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "GAANA SPRL"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\icon.ico"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Desinstaller.exe"'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" 7200
SectionEnd

Section "Uninstall"
  nsExec::Exec 'taskkill /F /IM VNL-SAD.exe'
  Delete "$DESKTOP\VNL-SAD.lnk"
  RMDir /r "$SMPROGRAMS\VNL-SAD"
  Delete "$INSTDIR\VNL-SAD.exe"
  Delete "$INSTDIR\icon.ico"
  Delete "$INSTDIR\Desinstaller.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  DeleteRegKey HKCU "Software\VNL-SAD"
SectionEnd

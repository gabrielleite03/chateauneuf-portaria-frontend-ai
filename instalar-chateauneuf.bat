@echo off
setlocal

set "GOOGLE_SHEET_ID=ID_DA_SUA_PLANILHA"
set "INSTALL_SCRIPT=%~dp0install-workstation.ps1"

if not exist "%INSTALL_SCRIPT%" (
  set "INSTALL_SCRIPT=%~dp0scripts\install-workstation.ps1"
)

if "%GOOGLE_SHEET_ID%"=="ID_DA_SUA_PLANILHA" (
  echo Edite este arquivo e troque ID_DA_SUA_PLANILHA pelo ID real da planilha.
  exit /b 1
)

if not exist "%INSTALL_SCRIPT%" (
  echo Arquivo install-workstation.ps1 nao encontrado.
  echo Coloque install-workstation.ps1 na mesma pasta deste BAT ou em .\scripts.
  exit /b 1
)

powershell.exe -ExecutionPolicy Bypass -File "%INSTALL_SCRIPT%" -GoogleSheetId "%GOOGLE_SHEET_ID%"

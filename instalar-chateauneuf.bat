@echo off
setlocal EnableExtensions
title Chateauneuf Portaria - Instalacao Docker
cd /d "%~dp0"

set "GOOGLE_SHEET_ID=ID_DA_SUA_PLANILHA"
set "INSTALL_SCRIPT=%~dp0install-workstation.ps1"
set "INSTALL_DIR=C:\ChateauneufPortaria"

if not exist "%INSTALL_SCRIPT%" (
  set "INSTALL_SCRIPT=%~dp0scripts\install-workstation.ps1"
)

echo ============================================================
echo  Chateauneuf Portaria - Instalacao Docker
echo ============================================================
echo Pasta do instalador: %~dp0
echo Script de instalacao: %INSTALL_SCRIPT%
echo Pasta alvo: %INSTALL_DIR%
echo.

if "%GOOGLE_SHEET_ID%"=="ID_DA_SUA_PLANILHA" (
  echo ERRO: Edite este arquivo e troque ID_DA_SUA_PLANILHA pelo ID real da planilha.
  goto :fail
)

if not exist "%INSTALL_SCRIPT%" (
  echo ERRO: Arquivo install-workstation.ps1 nao encontrado.
  echo Coloque install-workstation.ps1 na mesma pasta deste BAT ou em .\scripts.
  goto :fail
)

echo Iniciando instalacao. Todo o log do PowerShell ficara visivel abaixo.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%INSTALL_SCRIPT%" -GoogleSheetId "%GOOGLE_SHEET_ID%" -InstallDir "%INSTALL_DIR%"
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo ERRO: instalacao falhou com codigo %EXIT_CODE%.
  goto :fail
)

echo Conferindo containers em %INSTALL_DIR%...
if exist "%INSTALL_DIR%\.env.docker" (
  pushd "%INSTALL_DIR%"
  docker compose --env-file .env.docker ps
  set "PS_EXIT_CODE=%ERRORLEVEL%"
  popd
  if not "%PS_EXIT_CODE%"=="0" (
    echo ERRO: nao foi possivel confirmar os containers com docker compose ps.
    goto :fail
  )
) else (
  echo ERRO: arquivo %INSTALL_DIR%\.env.docker nao foi encontrado.
  goto :fail
)

echo.
echo Instalacao concluida e containers iniciados corretamente.
echo Aplicacao: http://localhost:8081
echo.
pause
exit /b 0

:fail
echo.
echo A janela ficara aberta para voce copiar ou ler o erro acima.
echo.
pause
exit /b 1

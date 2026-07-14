@echo off
setlocal EnableExtensions
title Chateauneuf Portaria - Instalacao Docker
cd /d "%~dp0"

echo Executando install-workstation.ps1...
echo Pasta do instalador: %~dp0
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-workstation.ps1" %*
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%EXIT_CODE%"=="0" (
  echo ERRO: instalacao falhou com codigo %EXIT_CODE%.
) else (
  echo Instalacao finalizada.
)
echo.
pause
exit /b %EXIT_CODE%

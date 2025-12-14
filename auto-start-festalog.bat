@echo off
:: Script para iniciar FestaLog automaticamente
:: Adicione um atalho deste arquivo em: shell:startup

title FestaLog - Auto Start
cd /d "C:\Users\Docs\Documents\festalog"

:: Aguarda Windows carregar
timeout /t 30 /nobreak

:: Inicia Docker Desktop
start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
timeout /t 20 /nobreak

:: Inicia FestaLog
call start-festalog.bat

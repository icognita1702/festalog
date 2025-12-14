@echo off
title FestaLog - Producao
cd /d "C:\Users\Docs\Documents\festalog"

echo ========================================
echo    FESTALOG - Modo Producao
echo ========================================
echo.

:: Verifica se Docker esta rodando
echo [1/3] Verificando Docker...
docker info >nul 2>&1
if errorlevel 1 (
    echo [!] Docker nao esta rodando. Iniciando...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    timeout /t 15 /nobreak
)

:: Inicia container do Evolution API
echo [2/3] Iniciando WhatsApp Bot...
docker-compose up -d

:: Aguarda container iniciar
timeout /t 5 /nobreak

:: Inicia o servidor Next.js em modo producao
echo [3/3] Iniciando FestaLog...
echo.
echo ========================================
echo    Acesse: http://localhost:3000
echo ========================================
echo.

npm run start

pause

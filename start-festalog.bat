@echo off
title FestaLog - Servidor
cd /d "C:\Users\Docs\Documents\festalog"

echo ========================================
echo    FESTALOG - Iniciando servidor...
echo ========================================
echo.

:: Aguarda 10 segundos para o Docker iniciar primeiro
timeout /t 10 /nobreak

:: Inicia o servidor Next.js
npm run dev

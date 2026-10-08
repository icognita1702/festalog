@echo off
title FestaLog - Servidor Local
echo ========================================================
echo                 INICIANDO FESTALOG...
echo ========================================================
echo.
cd /d "C:\Users\Docs\Documents\festalog"

echo [1/2] Abrindo navegador em http://localhost:3000 ...
start http://localhost:3000

echo [2/2] Iniciando servidor Next.js (npm run dev)...
echo Para encerrar o sistema, feche esta janela ou pressione CTRL+C.
echo.
npm run dev

pause

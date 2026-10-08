@echo off
title FestaLog - Publicar e Atualizar na Vercel
echo ========================================================
echo          PUBLICANDO ATUALIZACOES NA VERCEL...
echo ========================================================
echo.

cd /d "C:\Users\Docs\Documents\festalog"

echo [1/3] Salvando alteracoes locais...
git add .
git commit -m "Atualizacao automatica: %date% %time%"

echo.
echo [2/3] Enviando para o GitHub e Vercel (git push)...
git push origin master

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo   SUCESSO! O site foi enviado e esta sendo publicado!
    echo   Acesse: https://festalog.vercel.app/pedidos
    echo ========================================================
    echo.
    echo Abrindo https://festalog.vercel.app/pedidos no navegador...
    start https://festalog.vercel.app/pedidos
) else (
    echo.
    echo [AVISO] Ocorreu uma falha ao enviar para o GitHub.
    echo Verifique sua conexao com a internet e tente novamente.
)

echo.
echo Pressione qualquer tecla para fechar esta janela.
pause >nul

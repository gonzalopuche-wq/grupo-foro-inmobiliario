@echo off
chcp 65001 >nul
title GFI - Publicar Web a Vercel
cd /d "%~dp0"

echo ============================================
echo   GFI - Publicar Web a Vercel (sin GitHub)
echo ============================================
echo.

REM 1) Verificar que Node este instalado
where node >nul 2>nul
if errorlevel 1 goto nonode
for /f "delims=" %%v in ('node -v') do set NODEV=%%v
echo Node detectado: %NODEV%
echo.

REM 2) Autocrear .vercel\project.json con los IDs de ESTE proyecto
if not exist ".vercel\project.json" (
  if not exist ".vercel" mkdir ".vercel"
  > ".vercel\project.json" echo {"projectId":"prj_0uCUnFLISMudycpum2K9Im9Fo9zL","orgId":"team_gnl4Be0dgQ8BuAsBkPNBH6Xa"}
  echo Creado .vercel\project.json
) else (
  echo .vercel\project.json ya existe
)
echo.

REM 3) Instalar dependencias si faltan
if not exist "node_modules" (
  echo Instalando dependencias ^(npm install^)...
  call npm install
  if errorlevel 1 goto errinstall
) else (
  echo Dependencias ya instaladas.
)
echo.

REM 4) Compilar como chequeo
echo Compilando como chequeo ^(npm run build^)...
call npm run build
if errorlevel 1 goto buildwarn
goto login

:buildwarn
echo.
echo [AVISO] El build local fallo. Suele ser por falta del archivo .env local.
echo Vercel compila con sus propias variables, asi que igual puede publicar.
set /p CONT=Queres publicar igual a Vercel? (S/N):
if /i "%CONT%"=="S" goto login
echo Cancelado por el usuario.
goto fin

:login
echo.
REM 5) Iniciar sesion en Vercel solo si no hay sesion activa
call npx vercel whoami >nul 2>nul
if errorlevel 1 (
  echo No hay sesion de Vercel. Se abrira el navegador para iniciar sesion...
  call npx vercel login
)
echo.

REM 6) Publicar a produccion
echo Publicando a Vercel ^(produccion^)...
call npx vercel --prod --yes
goto fin

:nonode
echo [ERROR] Node.js no esta instalado.
echo Instalalo desde https://nodejs.org y volve a ejecutar este archivo.
echo.
pause
exit /b 1

:errinstall
echo [ERROR] Fallo npm install. Revisa los errores de arriba.
echo.
pause
exit /b 1

:fin
echo.
echo ============================================
echo   Proceso finalizado. Mira arriba la URL publicada.
echo ============================================
pause

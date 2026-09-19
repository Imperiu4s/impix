@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Nincs telepitve a Node.js ezen a gepen. Toltsd le: https://nodejs.org
  pause
  exit /b 1
)
if not exist node_modules (
  echo Elso futtatas: szukseges csomagok telepitese...
  call npm install --no-audit --no-fund
)
node get-cert.mjs %*
echo.
pause

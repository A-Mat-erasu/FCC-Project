@echo off
REM Step 3 + 4 tests: build Java engine -> bridge tests -> full REST API tests (needs MongoDB in .env)
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 ( echo [ERROR] Node.js 18+ required & pause & exit /b 1 )
if not exist .env ( copy .env.example .env >nul & notepad .env )
if not exist node_modules ( call npm install )

echo.
echo ===== Build Java engine =====
call java-engine\build.bat nodemo
if errorlevel 1 ( echo Java build failed & pause & exit /b 1 )

echo.
echo ===== Node ^<-^> Java bridge tests =====
node test-bridge.js
set BRIDGE=%errorlevel%

echo.
echo ===== REST API end-to-end tests =====
node test-api.js
set API=%errorlevel%

echo.
echo ===== SUMMARY =====
if %BRIDGE%==0 ( echo Bridge tests : PASSED ) else ( echo Bridge tests : FAILED )
if %API%==0 ( echo API tests    : PASSED ) else ( echo API tests    : FAILED )
pause

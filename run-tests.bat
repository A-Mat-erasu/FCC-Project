@echo off
REM One-click test: Node deps -> .env check -> MongoDB/schema tests -> Java engine build + demo
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 ( echo [ERROR] Node.js not found. Install from nodejs.org & pause & exit /b 1 )

if not exist .env (
  copy .env.example .env >nul
  echo.
  echo Created .env. Opening it now - set MONGO_URI to your Atlas or local URI, SAVE, close Notepad.
  notepad .env
)

if not exist node_modules (
  echo Installing npm packages...
  call npm install
  if errorlevel 1 ( echo [ERROR] npm install failed & pause & exit /b 1 )
)

echo.
echo ===== MongoDB / Mongoose tests =====
node test-db.js
set DBRESULT=%errorlevel%

echo.
echo ===== Java engine build + demo =====
call java-engine\build.bat
set JAVARESULT=%errorlevel%

echo.
echo ===== SUMMARY =====
if %DBRESULT%==0 ( echo MongoDB tests : PASSED ) else ( echo MongoDB tests : FAILED )
if %JAVARESULT%==0 ( echo Java engine   : PASSED ) else ( echo Java engine   : FAILED )
pause

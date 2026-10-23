@echo off
REM Build + run the Java engine demo on Windows (requires JDK 17+ on PATH)
REM Use "build.bat nodemo" to build only (used by the test scripts).
cd /d "%~dp0"

where javac >nul 2>nul
if errorlevel 1 (
  echo [ERROR] javac not found. Install JDK 17 or newer and reopen this window.
  exit /b 1
)

if exist out rmdir /s /q out
mkdir out\classes

echo Compiling...
javac -d out\classes -sourcepath src src\com\organregistry\Main.java src\com\organregistry\bridge\EngineCli.java
if errorlevel 1 (
  echo [ERROR] Compilation failed.
  exit /b 1
)

jar cfe out\organ-engine.jar com.organregistry.Main -C out\classes .
echo Built out\organ-engine.jar

if /i "%1"=="nodemo" exit /b 0
echo.
echo Running demo...
echo ------------------------------------------
java -jar out\organ-engine.jar

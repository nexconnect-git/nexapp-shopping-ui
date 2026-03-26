@echo off
set BASE_DIR=%cd%

echo Starting Angular apps...

start "admin-panel" cmd /k "npx ng serve --port 4200"
start "customer-app" cmd /k "npx ng serve --port 4201"
start "vendor-app" cmd /k "npx ng serve --port 4202"
start "delivery-app" cmd /k "npx ng serve --port 4203"

echo Waiting for servers to start...

call :waitForPort 4200
call :waitForPort 4201
call :waitForPort 4202
call :waitForPort 4203

echo All Angular apps started successfully!
pause
exit /b

:waitForPort
set PORT=%1

:loop
netstat -ano | findstr :%PORT% >nul
if %errorlevel% neq 0 (
    timeout /t 2 >nul
    goto loop
)

echo Port %PORT% is up!
exit /b
@echo off
rem Runs EchOS in your normal browser, for development.
rem
rem The browser is the fast loop: changes reload instantly and the dev tools
rem are right there. It is not the product. For the real application, which is
rem what ships, use play.cmd.

cd /d "%~dp0"
title EchOS (browser)

if not exist "node_modules" (
  echo First run - installing dependencies. This takes a minute.
  echo.
  call npm install
  echo.
)

echo Starting the dev server. Your browser will open at http://localhost:5173
echo A new machine is generated every time you load the page.
echo.
echo Close this window, or press Ctrl+C, to stop.
echo.

call npm start

echo.
echo Server stopped.
pause

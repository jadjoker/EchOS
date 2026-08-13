@echo off
rem Double-click this to play EchOS.
rem
rem This is the real thing: the same application that ships on Steam, in its
rem own window. It builds first, which takes a few seconds, then launches.
rem
rem For the browser version used while developing, run dev-browser.cmd instead.

cd /d "%~dp0"
title EchOS

if not exist "node_modules" (
  echo First run - installing dependencies. This takes a minute.
  echo.
  call npm install
  echo.
)

echo Building...
echo.
call npm run desktop

echo.
echo EchOS has closed.
pause

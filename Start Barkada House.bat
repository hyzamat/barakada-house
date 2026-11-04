@echo off
setlocal
title Barkada House
cd /d "%~dp0site"

where node >nul 2>&1
if %errorlevel%==0 (
  node server.mjs --open
  goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
  echo Node.js was not found, starting with Python instead...
  start "" "http://localhost:5173/"
  python -m http.server 5173
  goto :done
)

echo.
echo   Could not find Node.js or Python on this computer.
echo   Install Node.js from https://nodejs.org and run this file again.
echo.

:done
pause

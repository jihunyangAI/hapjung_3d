@echo off
rem Double-click to open the 3D page. Close this window to stop the local server.
cd /d "%~dp0"
start "" http://localhost:8765/
node tools\serve.js 8765

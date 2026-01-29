@echo off
set "PATH=D:\Program Files\nodejs;%PATH%"
echo === LAUNCHING WOS COMMANDER WEB APP ===
echo Clearing cache to ensure updates are applied...
npx expo start --web --clear
pause

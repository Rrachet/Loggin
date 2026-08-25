@echo off
set DEMO_PASSWORD=%DEMO_PASSWORD%
if "%DEMO_PASSWORD%"=="" set DEMO_PASSWORD=LogginDemo123!
npm run seed:demo

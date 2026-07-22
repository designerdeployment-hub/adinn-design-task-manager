@echo off
cd /d "%~dp0backend"
if not exist .env copy .env.example .env
npm install --no-audit --no-fund
npm run dev

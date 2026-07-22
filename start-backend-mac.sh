#!/bin/bash
cd "$(dirname "$0")/backend" || exit 1
[ -f .env ] || cp .env.example .env
npm install --no-audit --no-fund
npm run dev

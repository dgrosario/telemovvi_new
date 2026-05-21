#!/bin/sh
set -e

echo "[Entrypoint] Running database migrations..."
cd /app/packages/core
/app/node_modules/.bin/drizzle-kit migrate || echo "[Entrypoint] Migration failed, continuing anyway..."
echo "[Entrypoint] Migrations complete"

echo "[Entrypoint] Starting web application..."
cd /app/apps/web
exec /app/node_modules/.bin/tsx server.ts

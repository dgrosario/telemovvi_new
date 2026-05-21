#!/bin/sh
set -e

mkdir -p /app/apps/web/.next /app/apps/web/certificates

chown -R node:node /app/apps/web/.next /app/apps/web/certificates 2>/dev/null || true
chown -R node:node /app/node_modules 2>/dev/null || true
chown -R node:node /app/apps/web/node_modules 2>/dev/null || true
chown -R node:node /app/packages/core/node_modules 2>/dev/null || true
chown -R node:node /app/packages/typescript-config/node_modules 2>/dev/null || true
chown -R node:node /app/packages/eslint-config/node_modules 2>/dev/null || true

exec su-exec node "$@"

#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be configured in Coolify Runtime Variables}"

API_PORT=8080 node --enable-source-maps /app/api-dist/index.mjs &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

sleep 1
if ! kill -0 "$api_pid" 2>/dev/null; then
  echo "WARNING: The API process exited during startup. Nginx will continue serving the frontend; check DATABASE_URL and the database schema." >&2
  wait "$api_pid" || true
fi

nginx -g "daemon off;"
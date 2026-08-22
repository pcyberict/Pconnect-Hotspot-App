#!/bin/sh
set -eu

node --enable-source-maps /app/api-dist/index.mjs &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

sleep 1
if ! kill -0 "$api_pid" 2>/dev/null; then
  echo "The API process exited during startup. Check DATABASE_URL and the database schema." >&2
  wait "$api_pid"
  exit 1
fi

nginx -g "daemon off;"
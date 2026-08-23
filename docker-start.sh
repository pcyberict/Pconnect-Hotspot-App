#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be configured in Coolify Runtime Variables}"

run_api() {
  while :; do
    API_PORT=8080 node --enable-source-maps /app/api-dist/index.mjs
    status=$?
    echo "The API stopped with exit code ${status}; retrying in 5 seconds. Check DATABASE_URL and PostgreSQL logs." >&2
    sleep 5
  done
}

run_api &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

sleep 1

nginx -g "daemon off;"
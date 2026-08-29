#!/bin/sh
set -eu

: "${DATABASE_URL:?DATABASE_URL must be configured in Coolify Runtime Variables}"

run_api() {
  while :; do
    if API_PORT=8080 node --enable-source-maps /app/api-dist/index.mjs; then
      status=0
    else
      status=$?
    fi
    echo "The API stopped with exit code ${status}; retrying in 5 seconds. Check DATABASE_URL and PostgreSQL logs." >&2
    sleep 5
  done
}

run_api &
api_pid=$!

inject_metadata() {
  # Do not block the web server while PostgreSQL/API bootstrap completes.
  # The script keeps fallback metadata when the API is unavailable.
  node /app/scripts/inject-site-metadata.mjs
}

inject_metadata &
metadata_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
  kill "$metadata_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

# The frontend is built before the runtime API starts, so it contains fallback
# metadata initially. The background task replaces it once the API is ready.
nginx -g "daemon off;"
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

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

# The frontend is built before the runtime API starts, so the build can only
# contain fallback metadata. Wait for the initialized API and inject the saved
# site name/tagline into the HTML that social crawlers receive.
node /app/scripts/inject-site-metadata.mjs

nginx -g "daemon off;"
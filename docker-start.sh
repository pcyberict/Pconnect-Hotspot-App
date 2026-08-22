#!/bin/sh
set -eu

node --enable-source-maps /app/api-dist/index.mjs &
api_pid=$!

cleanup() {
  kill "$api_pid" 2>/dev/null || true
}

trap cleanup INT TERM EXIT

nginx -g "daemon off;"
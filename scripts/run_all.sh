#!/usr/bin/env bash
# Starts the server if needed, runs sync + check_db, stops the server, then backs up.
# Order: start → sync → check_db → stop → backup
#
# Usage:
#   ./scripts/run_all.sh              (defaults to localhost:3000)
#   ./scripts/run_all.sh <host>

set -euo pipefail

HOST="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SERVER_PID=""
SERVER_WE_STARTED=false

# --- helpers ---

wait_for_server() {
  echo "Waiting for server at $HOST ..."
  for i in $(seq 1 30); do
    if curl -sf "$HOST/api/health" >/dev/null 2>&1; then
      echo "Server is up."
      return 0
    fi
    sleep 2
  done
  echo "Error: server did not become ready after 60s"
  return 1
}

stop_server() {
  if [ "$SERVER_WE_STARTED" = true ] && [ -n "$SERVER_PID" ]; then
    echo "Stopping server (PID $SERVER_PID) ..."
    kill "$SERVER_PID" 2>/dev/null || true
    # Wait up to 10s for the process to exit
    for i in $(seq 1 10); do
      kill -0 "$SERVER_PID" 2>/dev/null || break
      sleep 1
    done
    # Force kill if still running
    kill -9 "$SERVER_PID" 2>/dev/null || true
    SERVER_PID=""
    echo "Server stopped."
  fi
}

cleanup() {
  stop_server
}
trap cleanup EXIT

# --- start server if not already running ---

if curl -sf "$HOST/api/health" >/dev/null 2>&1; then
  echo "Server already running at $HOST"
else
  echo "Starting server ..."
  cd "$REPO_ROOT"
  npm run dev:local > /tmp/nuxt-dev.log 2>&1 &
  SERVER_PID=$!
  SERVER_WE_STARTED=true
  wait_for_server
fi
echo ""

# --- sync ---

echo "==> sync"
"$SCRIPT_DIR/sync.sh" "$HOST"
echo ""

# --- check_db (while server is still up) ---

echo "==> check_db"
"$SCRIPT_DIR/check_db.sh" "$HOST"
echo ""

# --- stop server before backup ---

stop_server
echo ""

# --- backup (server must be down) ---

echo "==> backup"
cd "$REPO_ROOT"
"$SCRIPT_DIR/backup_db.sh"

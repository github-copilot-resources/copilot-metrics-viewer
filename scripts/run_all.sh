#!/usr/bin/env bash
# Runs sync, backup, and check_db in sequence.
# Verifies the server is reachable before doing anything.
#
# Usage:
#   ./scripts/run_all.sh              (defaults to localhost:3000)
#   ./scripts/run_all.sh <host>

set -euo pipefail

HOST="${1:-http://localhost:3000}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! curl -sf "$HOST/api/health" >/dev/null 2>&1; then
  echo "Error: server is not responding at $HOST"
  exit 1
fi
echo "Server is up at $HOST"
echo ""

echo "==> sync"
"$SCRIPT_DIR/sync.sh" "$HOST"
echo ""

echo "==> backup"
"$SCRIPT_DIR/backup_db.sh"
echo ""

echo "==> check_db"
"$SCRIPT_DIR/check_db.sh" "$HOST"

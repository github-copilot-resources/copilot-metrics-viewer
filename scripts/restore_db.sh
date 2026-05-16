#!/usr/bin/env bash
# Restores the PGlite data directory from a backup.
# Usage: ./scripts/restore-db.sh .data/backups/pglite-20260510-120000
#        ./scripts/restore-db.sh          (lists available backups)

set -euo pipefail

PGLITE_DIR="${PGLITE_DATA_DIR:-./.data/pglite}"
BACKUP_ROOT="./.data/backups"

if [ $# -eq 0 ]; then
  echo "Available backups:"
  ls -dt "$BACKUP_ROOT"/pglite-* 2>/dev/null || echo "  (none found)"
  echo ""
  echo "Usage: $0 <backup-path>"
  exit 0
fi

BACKUP_PATH="$1"

if [ ! -d "$BACKUP_PATH" ]; then
  echo "Error: backup not found at $BACKUP_PATH"
  exit 1
fi

if lsof -t :3000 >/dev/null 2>&1; then
  echo "Error: server appears to be running on port 3000 — stop it first"
  exit 1
fi

echo "Restoring from $BACKUP_PATH ..."
rm -rf "$PGLITE_DIR"
cp -r "$BACKUP_PATH" "$PGLITE_DIR"
echo "Done — start the server to resume"

#!/usr/bin/env bash
# Backs up the PGlite data directory to .data/backups/pglite-YYYYMMDD-HHMMSS
# The server must not be running — PGlite does not support concurrent access.

set -euo pipefail

PGLITE_DIR="${PGLITE_DATA_DIR:-./.data/pglite}"
BACKUP_ROOT="./.data/backups"
BACKUP_NAME="pglite-$(date +%Y%m%d-%H%M%S)"
BACKUP_PATH="$BACKUP_ROOT/$BACKUP_NAME"

if [ ! -d "$PGLITE_DIR" ]; then
  echo "Error: PGlite directory not found at $PGLITE_DIR"
  exit 1
fi

if lsof -t :3000 >/dev/null 2>&1; then
  echo "Error: server appears to be running on port 3000 — stop it first"
  exit 1
fi

mkdir -p "$BACKUP_ROOT"
cp -r "$PGLITE_DIR" "$BACKUP_PATH"
echo "Backup written to $BACKUP_PATH"

# Keep only the 10 most recent backups
ls -dt "$BACKUP_ROOT"/pglite-* 2>/dev/null | tail -n +11 | xargs -r rm -rf
echo "Old backups pruned, keeping last 10"

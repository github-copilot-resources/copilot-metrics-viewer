#!/usr/bin/env bash
# Wipes the PGlite database and restores from a backup.
# Useful when the schema is broken or corrupted — the server will
# recreate the schema cleanly on next startup, then restore your data.
#
# Usage:
#   ./scripts/wipe-and-restore.sh              (restores from latest backup)
#   ./scripts/wipe-and-restore.sh <backup-dir> (restores from specific backup)
#   ./scripts/wipe-and-restore.sh --list       (list available backups)

set -euo pipefail

PGLITE_DIR="${PGLITE_DATA_DIR:-./.data/pglite}"
BACKUP_ROOT="./.data/backups"

# List mode
if [ "${1:-}" = "--list" ]; then
  echo "Available backups:"
  ls -dt "$BACKUP_ROOT"/pglite-* 2>/dev/null || echo "  (none found)"
  exit 0
fi

# Resolve backup to use
if [ $# -ge 1 ]; then
  BACKUP_PATH="$1"
else
  BACKUP_PATH=$(ls -dt "$BACKUP_ROOT"/pglite-* 2>/dev/null | head -1 || true)
  if [ -z "$BACKUP_PATH" ]; then
    echo "Error: no backups found in $BACKUP_ROOT"
    echo "Run ./scripts/backup-db.sh first"
    exit 1
  fi
  echo "No backup specified — using latest: $BACKUP_PATH"
fi

if [ ! -d "$BACKUP_PATH" ]; then
  echo "Error: backup not found at $BACKUP_PATH"
  exit 1
fi

# Server must be down
if lsof -t :3000 >/dev/null 2>&1; then
  echo "Error: server is running on port 3000 — stop it first"
  exit 1
fi

echo ""
echo "This will WIPE .data/pglite and replace it with:"
echo "  $BACKUP_PATH"
echo ""
read -r -p "Continue? [y/N] " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
  echo "Aborted"
  exit 0
fi

echo ""
echo "Wiping $PGLITE_DIR ..."
rm -rf "$PGLITE_DIR"

echo "Restoring from $BACKUP_PATH ..."
cp -r "$BACKUP_PATH" "$PGLITE_DIR"

echo ""
echo "Done. Start the server — it will reinitialize the schema automatically."

#!/usr/bin/env bash
# Shows how many days of data are stored in the database.
# Uses the running server's API — start the server first.
#
# Usage:
#   ./scripts/check-db.sh              (defaults to localhost:3000)
#   ./scripts/check-db.sh <host>

set -euo pipefail

HOST="${1:-http://localhost:3000}"

# Load scope/org from .env
if [ -f .env ]; then
  SCOPE=$(grep -E '^NUXT_PUBLIC_SCOPE=' .env | cut -d= -f2 | tr -d '"' | tr -d "'")
  GITHUB_ORG=$(grep -E '^NUXT_PUBLIC_GITHUB_ORG=' .env | cut -d= -f2 | tr -d '"' | tr -d "'")
  GITHUB_ENT=$(grep -E '^NUXT_PUBLIC_GITHUB_ENT=' .env | cut -d= -f2 | tr -d '"' | tr -d "'")
fi

SCOPE="${SCOPE:-organization}"
GITHUB_ORG="${GITHUB_ORG:-}"
GITHUB_ENT="${GITHUB_ENT:-}"

if [ "$SCOPE" = "enterprise" ]; then
  IDENTIFIER="${GITHUB_ENT}"
  ID_PARAM="githubEnt=$IDENTIFIER"
else
  IDENTIFIER="${GITHUB_ORG}"
  ID_PARAM="githubOrg=$IDENTIFIER"
fi

if [ -z "$IDENTIFIER" ]; then
  echo "Error: could not determine org/enterprise from .env"
  exit 1
fi

if ! curl -sf "$HOST/api/health" >/dev/null 2>&1; then
  echo "Error: server is not responding at $HOST"
  exit 1
fi

RESPONSE=$(curl -s "$HOST/api/admin/sync-status?scope=$SCOPE&$ID_PARAM")

echo "$RESPONSE" | node -e "
const chunks = [];
process.stdin.on('data', d => chunks.push(d));
process.stdin.on('end', () => {
  const d = JSON.parse(chunks.join(''));
  const missing = d.stats.missingDates.length > 0 ? '(' + d.stats.missingDates.join(', ') + ')' : '';
  console.log('');
  console.log('  Scope      : ' + d.scope + ':' + d.identifier);
  console.log('  Range      : ' + d.dateRange.start + ' → ' + d.dateRange.end);
  console.log('  Stored days: ' + d.stats.syncedDays);
  console.log('  Missing    : ' + d.stats.missingDays + (missing ? ' ' + missing : ''));
  console.log('');
});"

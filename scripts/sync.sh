#!/usr/bin/env bash
# Triggers a bulk sync of the last 28 days of Copilot metrics.
# Reads scope and org/enterprise from .env if present.
# Usage: ./scripts/sync.sh [host]
#   host defaults to http://localhost:3000

set -euo pipefail

HOST="${1:-http://localhost:3000}"

# Load .env then .env.local (local overrides base), pulling only the vars we need
SCOPE="" GITHUB_ORG="" GITHUB_ENT=""
for envfile in .env .env.local; do
  if [ -f "$envfile" ]; then
    val=$(grep -E '^NUXT_PUBLIC_SCOPE=' "$envfile" | tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'" || true)
    if [ -n "$val" ]; then SCOPE="$val"; fi
    val=$(grep -E '^NUXT_PUBLIC_GITHUB_ORG=' "$envfile" | tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'" || true)
    if [ -n "$val" ]; then GITHUB_ORG="$val"; fi
    val=$(grep -E '^NUXT_PUBLIC_GITHUB_ENT=' "$envfile" | tail -1 | cut -d= -f2 | tr -d '"' | tr -d "'" || true)
    if [ -n "$val" ]; then GITHUB_ENT="$val"; fi
  fi
done

SCOPE="${SCOPE:-organization}"
GITHUB_ORG="${GITHUB_ORG:-}"
GITHUB_ENT="${GITHUB_ENT:-}"

# Pick identifier based on scope
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

# Check the server is reachable
if ! curl -sf "$HOST/api/health" >/dev/null 2>&1; then
  echo "Error: server is not responding at $HOST"
  exit 1
fi

echo "Syncing last 28 days for $SCOPE:$IDENTIFIER ..."
RESPONSE=$(curl -s -X POST "$HOST/api/admin/sync?action=sync-last-28&scope=$SCOPE&$ID_PARAM")
echo "$RESPONSE"

# Surface errors clearly
if echo "$RESPONSE" | grep -q '"success":false'; then
  echo ""
  echo "Warning: sync reported errors — check the response above"
  exit 1
fi

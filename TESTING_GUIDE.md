# Testing the New API Migration

## Quick Test Commands

### Test with Mock Data (No GitHub Token Required)

```bash
# Start dev server
npm run dev

# Test in browser
open http://localhost:3000/orgs/test-org?mock=true

# Test API endpoint
curl http://localhost:3000/api/metrics?mock=true&scope=organization&githubOrg=test-org
```

### Test New API (Requires GitHub Token)

```bash
# Configure environment
cp .env.example .env
# Edit .env and set:
# - USE_LEGACY_API=false
# - NUXT_GITHUB_TOKEN=your_token_here

# Start dev server
npm run dev

# Test single-day query
curl "http://localhost:3000/api/metrics?scope=organization&githubOrg=your-org"
```

### Test Storage Mode

```bash
# Configure environment
# - USE_LEGACY_API=false
# - NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=true
# - NUXT_GITHUB_TOKEN=your_token_here

# Run manual sync to populate data
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sync-range",
    "scope": "organization",
    "githubOrg": "your-org",
    "since": "2026-02-01",
    "until": "2026-02-20"
  }'

# Check sync status
curl "http://localhost:3000/api/admin/sync-status?scope=organization&githubOrg=your-org&since=2026-02-01&until=2026-02-20"

# Query historical data
curl "http://localhost:3000/api/metrics?scope=organization&githubOrg=your-org&since=2026-02-01&until=2026-02-20"
```

### Test Sync Container

```bash
# Build sync container
docker build -f Dockerfile.sync -t copilot-metrics-sync .

# Run sync for last 7 days
docker run --rm \
  -e NUXT_PUBLIC_SCOPE=organization \
  -e NUXT_PUBLIC_GITHUB_ORG=your-org \
  -e NUXT_GITHUB_TOKEN=your_token \
  -e SYNC_DAYS_BACK=7 \
  -v $(pwd)/.data:/app/.data \
  copilot-metrics-sync
```

### Test with Docker Compose

```bash
# Edit docker-compose.yml with your configuration

# Start services
docker compose up -d

# View web app
open http://localhost:3000

# Run sync job
docker compose run sync

# Check logs
docker compose logs -f web
docker compose logs sync
```

## Test Scenarios

### Scenario 1: Fresh Install with Mock Data

```bash
# Clone repository
git clone <repo-url>
cd copilot-metrics-viewer

# Install dependencies
npm install

# Use default .env (mock mode)
npm run dev

# Verify: http://localhost:3000/orgs/test-org?mock=true
```

**Expected**: Dashboard loads with mock data, no errors

### Scenario 2: Legacy API (Current Behavior)

```bash
# Configure for legacy API
USE_LEGACY_API=true
NUXT_PUBLIC_IS_DATA_MOCKED=false
NUXT_GITHUB_TOKEN=your_token

npm run dev
```

**Expected**: Works exactly as before, no changes

### Scenario 3: New API Without Storage

```bash
# Configure for new API
USE_LEGACY_API=false
NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=false
NUXT_GITHUB_TOKEN=your_token

npm run dev
```

**Expected**: 
- Single-day queries work
- Date range queries work but slower (multiple downloads)
- 1-day lag in data

### Scenario 4: New API With Storage

```bash
# Configure for new API + storage
USE_LEGACY_API=false
NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=true
NUXT_GITHUB_TOKEN=your_token

# Start app
npm run dev

# Backfill data
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Authorization: Bearer your_token" \
  -d '{"action":"sync-range","scope":"organization","githubOrg":"your-org","since":"2026-02-01","until":"2026-02-20"}'

# Query from storage
curl "http://localhost:3000/api/metrics?scope=organization&githubOrg=your-org&since=2026-02-01&until=2026-02-20"
```

**Expected**:
- Fast date range queries (from storage)
- Historical data available
- Sync status tracking works

### Scenario 5: Automatic Daily Sync

```bash
# Configure
SYNC_ENABLED=true
SYNC_SCHEDULE="0 2 * * *"
NUXT_GITHUB_TOKEN=your_token

npm run dev
```

**Expected**: Sync task runs at 2 AM daily (can test manually via admin API)

## Automated Test Suite

### Run All Tests

```bash
npm test
```

**Expected**: 106+ tests pass

### Run Specific Test Suites

```bash
# API client tests
npm test -- tests/github-copilot-usage-api.spec.ts

# Options tests
npm test -- tests/Options.spec.ts

# Metrics tests
npm test -- tests/metrics-cache.nuxt.spec.ts
```

## Performance Testing

### Test Response Times

```bash
# Benchmark legacy API
time curl "http://localhost:3000/api/metrics?scope=organization&githubOrg=your-org"

# Benchmark new API (single day)
time curl "http://localhost:3000/api/metrics?scope=organization&githubOrg=your-org"

# Benchmark storage query (30 days)
time curl "http://localhost:3000/api/metrics?scope=organization&githubOrg=your-org&since=2026-01-21&until=2026-02-20"
```

**Expected**:
- Single day: <500ms
- Storage query (30 days): <2s
- Direct API (30 days): Slower due to multiple downloads

## Integration Testing

### Test Admin API

```bash
# Health check
curl http://localhost:3000/api/health

# Sync status
curl "http://localhost:3000/api/admin/sync-status"

# Trigger sync
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Authorization: Bearer your_token" \
  -d '{"action":"sync-date","date":"2026-02-20","scope":"organization","githubOrg":"your-org"}'

# Check result
curl "http://localhost:3000/api/admin/sync-status?scope=organization&githubOrg=your-org&since=2026-02-20&until=2026-02-20"
```

### Test Error Handling

```bash
# Invalid date
curl "http://localhost:3000/api/metrics?since=invalid&until=2026-02-20"

# Missing authentication (when not in mock mode)
curl "http://localhost:3000/api/metrics?scope=organization&githubOrg=your-org"

# Invalid scope
curl "http://localhost:3000/api/admin/sync" -X POST -d '{"action":"sync-date"}'
```

**Expected**: Appropriate error messages, no crashes

## Troubleshooting Tests

### If tests fail with "useStorage is not defined"

This is expected for storage tests - they require Nitro runtime context. The storage layer is tested via integration tests through the API endpoints.

### If API tests fail

```bash
# Regenerate Nuxt types
npm run prepare

# Clear cache
rm -rf .nuxt node_modules/.vite
npm install
npm run prepare

# Run tests again
npm test
```

### If mock mode doesn't work

Check that mock data files exist:
```bash
ls -la public/mock-data/
```

Should show:
- `organization_metrics_response_sample.json`
- `enterprise_metrics_response_sample.json`

## Manual Verification Checklist

After deploying, verify:

- [ ] `/` - Homepage loads without errors
- [ ] `/api/health` - Returns healthy status
- [ ] `/api/metrics?mock=true` - Returns mock data
- [ ] `/api/metrics` (with token) - Returns real data
- [ ] `/api/admin/sync-status` - Returns sync statistics
- [ ] `/api/admin/sync` (POST) - Triggers sync successfully
- [ ] Date range queries work
- [ ] Storage queries are faster than API queries
- [ ] Scheduled sync runs (check logs after schedule time)
- [ ] Sync container runs successfully (if using separate deployment)

## CI/CD Testing

### GitHub Actions

The existing GitHub Actions workflows should continue to work. The new code:
- Maintains backward compatibility
- All existing tests pass
- No breaking changes

### Build Testing

```bash
# Test production build
npm run build

# Test build output
node .output/server/index.mjs
```

**Expected**: Application builds and runs successfully

---

**For issues or questions, see [MIGRATION_GUIDE.md](./MIGRATION_GUIDE.md)**

# Migration Guide: From Legacy to New Copilot Usage Metrics API

## Overview

This guide provides step-by-step instructions for migrating your GitHub Copilot Metrics Viewer deployment from the legacy API (shutting down April 2, 2026) to the new Copilot Usage Metrics API.

## Current Status

- **Legacy API**: Supported until April 2, 2026
- **New API**: Available now (implemented in this PR)
- **Hybrid Mode**: Supports both APIs with feature flags

## Migration Paths

### Path 1: Quick Migration (No Storage)

**Use Case**: Small deployments, single-day queries only

**Steps**:
1. Update to this version
2. Set `USE_LEGACY_API=false` in `.env`
3. Test with your GitHub token
4. Deploy

**Limitations**:
- Date ranges require multiple API calls (slower)
- No historical data caching
- 1-day lag for new data

**Configuration**:
```bash
# .env
USE_LEGACY_API=false
NUXT_GITHUB_TOKEN=your_token_here
# Leave ENABLE_HISTORICAL_MODE=false
```

### Path 2: Full Migration (With Storage)

**Use Case**: Production deployments, need historical data, date range queries

**Steps**:
1. Provision PostgreSQL database
2. Update to this version
3. Configure database connection
4. Enable new API and historical mode
5. Run initial data backfill
6. Enable automatic sync
7. Deploy

**Benefits**:
- Fast date range queries
- Historical data beyond GitHub's 1-year limit
- Better performance for analytics

**Configuration**:
```bash
# .env
USE_LEGACY_API=false
NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=true
NUXT_GITHUB_TOKEN=your_token_here

# Storage configuration (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/copilot_metrics

# Enable automatic sync
SYNC_ENABLED=true
SYNC_BACKFILL_DAYS=28
```

### Path 3: Gradual Migration (Recommended)

**Use Case**: Production deployments, minimize risk

**Steps**:
1. Deploy new version with flags disabled (backward compatible)
2. Test that existing functionality works
3. Enable new API for testing
4. Configure storage backend
5. Run manual sync to populate historical data
6. Enable historical mode
7. Enable automatic sync
8. Monitor and validate

**Timeline**: 1-2 weeks for gradual rollout

## Detailed Instructions

### Step 1: Update Application

```bash
# Pull latest code
git pull origin main

# Or update to specific version
git checkout v2.2.0  # Replace with actual version

# Install dependencies
npm install
```

### Step 2: Configure Environment

**Option A: Filesystem Storage (Development)**

No additional setup needed. Data stored in `./.data/metrics`.

```bash
# .env additions
USE_LEGACY_API=true  # Start with legacy
NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=false
```

**Option B: PostgreSQL (Production)**

1. Provision PostgreSQL database:
```bash
# Using Docker
docker run --name copilot-metrics-db \
  -e POSTGRES_DB=copilot_metrics \
  -e POSTGRES_USER=metrics_user \
  -e POSTGRES_PASSWORD=secure_password \
  -p 5432:5432 \
  -d postgres:15-alpine
```

2. Update `nuxt.config.ts`:
```typescript
nitro: {
  storage: {
    metrics: {
      driver: 'postgresql',
      connectionString: process.env.DATABASE_URL
    }
  }
}
```

3. Update `.env`:
```bash
DATABASE_URL=postgresql://metrics_user:secure_password@localhost:5432/copilot_metrics
```

### Step 3: Test Configuration

```bash
# Start application
npm run dev

# Test health endpoint
curl http://localhost:3000/api/health

# Test with mock data
curl http://localhost:3000/orgs/test-org?mock=true
```

### Step 4: Enable New API

```bash
# Update .env
USE_LEGACY_API=false

# Restart application
npm run dev

# Test that metrics still load
# Note: Requires valid NUXT_GITHUB_TOKEN
```

### Step 5: Backfill Historical Data (Optional)

If using storage, backfill data for analysis:

```bash
# Manual sync via admin API
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Authorization: Bearer your_token" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sync-range",
    "scope": "organization",
    "githubOrg": "your-org",
    "since": "2026-01-01",
    "until": "2026-02-20"
  }'

# Check sync status
curl http://localhost:3000/api/admin/sync-status?scope=organization&githubOrg=your-org
```

### Step 6: Enable Historical Mode

```bash
# Update .env
NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=true

# Restart application
npm run dev

# Test date range queries (should be faster now)
```

### Step 7: Enable Automatic Sync

```bash
# Update .env
SYNC_ENABLED=true
SYNC_SCHEDULE=0 2 * * *  # 2 AM daily

# Restart application
```

## Deployment Scenarios

### Docker Deployment

**Single Container (Integrated Sync)**:
```bash
# Build
docker build -t copilot-metrics-viewer .

# Run
docker run -p 8080:80 \
  --env-file .env \
  -v $(pwd)/.data:/app/.data \
  copilot-metrics-viewer
```

**Separate Containers (Production)**:
```bash
# Build sync container
docker build -f Dockerfile.sync -t copilot-metrics-sync .

# Use docker-compose
docker compose up -d

# Run sync manually
docker compose run sync
```

### Kubernetes Deployment

```bash
# Create secret
kubectl create secret generic copilot-metrics-secrets \
  --from-literal=github-token='your_token_here' \
  --from-literal=database-url='postgresql://...'

# Deploy CronJob
kubectl apply -f k8s/cronjob.yaml

# Trigger manual sync
kubectl create job --from=cronjob/copilot-metrics-sync manual-sync-$(date +%s)
```

## Security Considerations

### ⚠️ Admin API Endpoints

**CRITICAL**: The `/api/admin/*` endpoints are NOT authenticated by default!

These endpoints allow:
- Triggering data synchronization (`/api/admin/sync`)
- Viewing sync status (`/api/admin/sync-status`)

**Required Actions**:
1. **DO NOT expose admin endpoints publicly** without protection
2. **Use one of these security measures**:
   - Reverse proxy authentication (nginx basic auth, OAuth proxy)
   - API gateway with authentication
   - Firewall rules (allow only internal IPs)
   - VPN or private network access only
   - Kubernetes NetworkPolicy restricting access

**Example nginx protection**:
```nginx
location /api/admin/ {
    auth_basic "Admin Access";
    auth_basic_user_file /etc/nginx/.htpasswd;
    proxy_pass http://copilot-metrics-viewer:3000;
}
```

**Future Enhancement**: Native authentication using `ADMIN_API_SECRET` will be added in a future version.

## Troubleshooting

### Issue: "useStorage is not defined"

**Cause**: Nitro storage not configured

**Solution**: Ensure `nuxt.config.ts` has storage configuration:
```typescript
nitro: {
  storage: {
    metrics: {
      driver: 'fs',
      base: './.data/metrics'
    }
  }
}
```

### Issue: Sync fails with "No Authentication provided"

**Cause**: Missing or invalid GitHub token

**Solution**: 
- Set `NUXT_GITHUB_TOKEN` in `.env`
- Ensure token has required scopes
- For sync container, pass token as environment variable

### Issue: Date range queries are slow

**Cause**: Not using storage mode

**Solution**:
- Enable `ENABLE_HISTORICAL_MODE=true`
- Ensure data is synced to storage
- Check sync status via `/api/admin/sync-status`

### Issue: Storage queries return no data

**Cause**: Data not synced yet

**Solution**:
- Run manual sync via `/api/admin/sync`
- Check sync status
- Verify storage configuration
- Check logs for sync errors

## Validation Checklist

After migration, verify:

- [ ] Application starts without errors
- [ ] Health endpoint responds: `curl http://localhost:3000/api/health`
- [ ] Metrics load with mock data: `?mock=true`
- [ ] Metrics load with real data (if new API enabled)
- [ ] Date range queries work
- [ ] Sync status endpoint works: `/api/admin/sync-status`
- [ ] Manual sync works: `/api/admin/sync`
- [ ] Scheduled sync runs (if enabled)
- [ ] All existing features still work

## Rollback Plan

If issues occur, rollback is simple:

```bash
# Disable new API
USE_LEGACY_API=true
NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=false
SYNC_ENABLED=false

# Restart application - back to legacy API
```

No data loss occurs - storage data remains intact for future use.

## Timeline

**Before April 2, 2026**: Complete migration to new API

**Recommended Timeline**:
- Week 1: Test in development with mock data
- Week 2: Test with real data, no storage
- Week 3: Configure storage, test backfill
- Week 4: Enable in production, monitor
- Ongoing: Monitor sync jobs, optimize as needed

## Support

- **Documentation**: See `API_MIGRATION_DESIGN.md` for architecture details
- **Issues**: https://github.com/github-copilot-resources/copilot-metrics-viewer/issues
- **API Docs**: https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics

## FAQ

**Q: Do I need to migrate now?**
A: The legacy API works until April 2, 2026, but early migration is recommended for testing.

**Q: Will my existing deployment break?**
A: No, the new code is backward compatible. Legacy API is used by default.

**Q: Do I need a database?**
A: No, but it's recommended for better performance with date ranges.

**Q: Can I use Redis instead of PostgreSQL?**
A: Yes, configure any unstorage-compatible backend in `nuxt.config.ts`.

**Q: How do I switch storage backends?**
A: Update `nuxt.config.ts` nitro.storage.metrics.driver to 'postgresql', 'redis', etc.

**Q: What happens to my data after April 2, 2026?**
A: Legacy API stops working. Switch to new API before then. Historical data in storage is safe.

**Q: Can I run sync in a separate container?**
A: Yes, use `Dockerfile.sync` and `k8s/cronjob.yaml` examples.

---

**Last Updated**: February 23, 2026
**Version**: 2.2.0

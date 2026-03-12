# GitHub Copilot Metrics API - Quick Reference

## API Comparison: Legacy vs New

This document provides a quick reference for the key differences between the legacy Copilot Metrics API (shutting down April 2, 2026) and the new Copilot Usage Metrics API.

## Quick Comparison Table

| Feature | Legacy API | New API |
|---------|-----------|---------|
| **API Type** | Synchronous REST | Async File Download |
| **Response Format** | JSON Array | NDJSON File (via signed URL) |
| **Data Availability** | Real-time | Daily (next day) |
| **Historical Data** | API call per request | Pre-generated daily files |
| **Rate Limits** | Standard API limits | Download limits |
| **Caching** | Application level | Not applicable |
| **Date Range** | Single API call | Multiple file downloads |
| **Shutdown Date** | April 2, 2026 | N/A (new API) |

## API Endpoints

### Legacy API (Deprecated - April 2026)

**Organization Metrics**:
```
GET https://api.github.com/orgs/{org}/copilot/metrics?since=YYYY-MM-DD&until=YYYY-MM-DD
```

**Enterprise Metrics**:
```
GET https://api.github.com/enterprises/{enterprise}/copilot/metrics?since=YYYY-MM-DD&until=YYYY-MM-DD
```

**Team Metrics**:
```
GET https://api.github.com/orgs/{org}/team/{team}/copilot/metrics
GET https://api.github.com/enterprises/{enterprise}/team/{team}/copilot/metrics
```

### New API (Current)

**Organization Daily Report**:
```
GET https://api.github.com/orgs/{org}/copilot/metrics/reports/organization-1-day?day=YYYY-MM-DD
```

**Enterprise Daily Report**:
```
GET https://api.github.com/enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day?day=YYYY-MM-DD
```

**Response**: Returns a signed download URL for the NDJSON file.

## Authentication

### Required Token Scopes (Same for Both APIs)

**Classic PAT**:
- `copilot` (for basic metrics)
- `manage_billing:copilot` (for billing-related metrics)
- `manage_billing:enterprise` (for enterprise billing)
- `read:enterprise` (for enterprise metrics)
- `read:org` (for organization metrics)

**Fine-grained Token**:
- Repository access: Not required
- Organization permissions: "View Copilot usage"
- Enterprise permissions: "View Enterprise Copilot Metrics"

## Request/Response Examples

### Legacy API

**Request**:
```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  https://api.github.com/orgs/octo-org/copilot/metrics?since=2026-02-01&until=2026-02-15
```

**Response**: Direct JSON array
```json
[
  {
    "date": "2026-02-01",
    "total_active_users": 150,
    "total_engaged_users": 120,
    "copilot_ide_code_completions": {
      "total_engaged_users": 110,
      "editors": [...]
    },
    ...
  },
  ...
]
```

### New API

**Step 1: Request Download URL**
```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer ${GITHUB_TOKEN}" \
  https://api.github.com/orgs/octo-org/copilot/metrics/reports/organization-1-day?day=2026-02-01
```

**Response**: Signed URL
```json
{
  "download_url": "https://copilot-reports.github.com/reports/abc123def456.ndjson?signature=xyz&expires=1234567890",
  "expires_at": "2026-02-01T12:00:00Z"
}
```

**Step 2: Download NDJSON File**
```bash
curl -L "${DOWNLOAD_URL}" -o metrics-2026-02-01.ndjson
```

**File Content**: One JSON object per line
```json
{"date":"2026-02-01","total_active_users":150,"total_engaged_users":120,"copilot_ide_code_completions":{"total_engaged_users":110,"editors":[...]}}
```

## Data Schema

### Key Differences

The schema is largely similar, but with some important differences:

1. **Response Structure**:
   - Legacy: Array of daily metrics
   - New: Single object per line in NDJSON file

2. **Data Aggregation**:
   - Legacy: Server aggregates date range
   - New: Client must aggregate multiple daily files

3. **Availability Delay**:
   - Legacy: Real-time (or near real-time)
   - New: Daily reports available next day

4. **File Expiration**:
   - Legacy: N/A
   - New: Signed URLs expire (typically 1 hour)

### Schema Example

Both APIs use similar schema for daily metrics:

```typescript
interface DailyMetrics {
  date: string; // YYYY-MM-DD
  total_active_users: number;
  total_engaged_users: number;
  copilot_ide_code_completions?: {
    total_engaged_users: number;
    languages?: Array<{
      name: string;
      total_engaged_users: number;
    }>;
    editors?: Array<{
      name: string;
      total_engaged_users: number;
      models?: Array<{
        name: string;
        is_custom_model: boolean;
        total_engaged_users: number;
        languages?: Array<{
          name: string;
          total_engaged_users: number;
          total_code_suggestions: number;
          total_code_acceptances: number;
          total_code_lines_suggested: number;
          total_code_lines_accepted: number;
        }>;
      }>;
    }>;
  };
  copilot_ide_chat?: {...};
  copilot_dotcom_chat?: {...};
  copilot_dotcom_pull_requests?: {...};
}
```

## Migration Checklist

### For Application Developers

- [ ] Review architecture design document
- [ ] Understand async file download model
- [ ] Plan for data persistence (database)
- [ ] Update API client to use new endpoints
- [ ] Implement NDJSON parsing
- [ ] Handle signed URL expiration
- [ ] Implement retry logic
- [ ] Add data aggregation for date ranges
- [ ] Update tests
- [ ] Update documentation

### For Deployment Teams

- [ ] Provision database (PostgreSQL recommended)
- [ ] Update environment variables
- [ ] Configure data sync schedule
- [ ] Set up monitoring for sync jobs
- [ ] Plan for initial data backfill
- [ ] Test backup and restore procedures
- [ ] Update deployment documentation

### For End Users

- [ ] No action required (if app updated correctly)
- [ ] Note: Historical data may have 1-day delay
- [ ] Report any issues to support

## Common Pitfalls

### 1. Signed URL Expiration

**Problem**: Download URLs expire quickly (typically 1 hour)

**Solution**: 
- Request new URL if expired
- Download and process immediately
- Don't store URLs for later use

### 2. Rate Limiting

**Problem**: Requesting many daily reports quickly may hit rate limits

**Solution**:
- Implement exponential backoff
- Use conditional requests
- Cache downloaded data

### 3. NDJSON Parsing

**Problem**: NDJSON is not the same as JSON array

**Solution**:
```javascript
// Wrong (JSON array)
const data = JSON.parse(fileContent);

// Correct (NDJSON)
const lines = fileContent.split('\n').filter(line => line.trim());
const data = lines.map(line => JSON.parse(line));
```

### 4. Missing Historical Data

**Problem**: Can only access last 365 days from GitHub

**Solution**:
- Persist data in your own database
- Set up automated daily sync
- Plan retention policy

### 5. Date Range Queries

**Problem**: No single API call for date ranges

**Solution**:
- Download each day separately
- Aggregate in application
- Use database for efficient range queries

## Performance Considerations

### Legacy API
- **Pros**: Single request for date range, fast for small ranges
- **Cons**: Can be slow for large date ranges, rate limits

### New API
- **Pros**: Pre-computed daily files, consistent performance
- **Cons**: Multiple requests for ranges, requires aggregation

### Recommendations

1. **For Single-Day Queries**:
   - Use new API directly (after migration)
   - Similar performance to legacy

2. **For Date Range Queries**:
   - Use database (store daily files)
   - Much faster than multiple API calls

3. **For Real-Time Needs**:
   - Legacy API: Real-time
   - New API: 1-day lag
   - Solution: Accept 1-day lag or use alternative real-time sources

## Code Migration Examples

### Before (Legacy API)

```typescript
// Old approach - single API call
async function getMetrics(org: string, since: string, until: string) {
  const response = await fetch(
    `https://api.github.com/orgs/${org}/copilot/metrics?since=${since}&until=${until}`,
    {
      headers: { Authorization: `Bearer ${token}` }
    }
  );
  return await response.json();
}
```

### After (New API)

```typescript
// New approach - multiple downloads and aggregation
async function getMetrics(org: string, since: string, until: string) {
  const dates = getDateRange(since, until);
  const allMetrics = [];
  
  for (const date of dates) {
    // Step 1: Get download URL
    const urlResponse = await fetch(
      `https://api.github.com/orgs/${org}/copilot/metrics/reports/organization-1-day?day=${date}`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    const { download_url } = await urlResponse.json();
    
    // Step 2: Download NDJSON file
    const fileResponse = await fetch(download_url);
    const ndjsonContent = await fileResponse.text();
    
    // Step 3: Parse NDJSON
    const lines = ndjsonContent.split('\n').filter(line => line.trim());
    const dailyMetrics = lines.map(line => JSON.parse(line));
    
    allMetrics.push(...dailyMetrics);
  }
  
  return allMetrics;
}

function getDateRange(since: string, until: string): string[] {
  const dates = [];
  const current = new Date(since);
  const end = new Date(until);
  
  while (current <= end) {
    dates.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
}
```

### Better Approach (With Database)

```typescript
// Best approach - use database for historical data
async function getMetrics(org: string, since: string, until: string) {
  // Check if data is in database
  const dbMetrics = await metricsRepository.getMetricsForDateRange(
    'organization',
    org,
    since,
    until
  );
  
  // If all dates are available, return from DB (fast!)
  if (dbMetrics.length === getDateRange(since, until).length) {
    return dbMetrics;
  }
  
  // Otherwise, fetch missing dates and store
  const missingDates = findMissingDates(dbMetrics, since, until);
  const newMetrics = await fetchAndStoreMetrics(org, missingDates);
  
  return [...dbMetrics, ...newMetrics].sort((a, b) => a.date.localeCompare(b.date));
}
```

## FAQ

### Q: When does the legacy API shut down?
**A**: April 2, 2026

### Q: Will my existing code break?
**A**: Yes, if you haven't migrated to the new API by April 2, 2026

### Q: Can I access real-time data with the new API?
**A**: No, the new API provides daily reports with a 1-day lag

### Q: How far back can I get historical data?
**A**: The new API provides up to 365 days of historical data

### Q: Do I need a database?
**A**: Highly recommended for date range queries and historical analysis

### Q: What if I only need today's data?
**A**: You can use the new API directly without a database (but note 1-day lag)

### Q: Is the data schema the same?
**A**: Mostly, but there may be minor differences. Test thoroughly.

### Q: What happens to team metrics?
**A**: Team metrics are included in organization/enterprise reports, but may require filtering

### Q: Can I still use the same authentication?
**A**: Yes, token scopes are the same

### Q: What about seats data?
**A**: Seats API remains similar (separate endpoint, not affected by metrics API change)

## Support Resources

- **GitHub Docs**: https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics
- **Changelog**: https://github.blog/changelog/2026-01-29-closing-down-notice-of-legacy-copilot-metrics-apis/
- **Design Document**: [API_MIGRATION_DESIGN.md](./API_MIGRATION_DESIGN.md)
- **Roadmap**: [MIGRATION_ROADMAP.md](./MIGRATION_ROADMAP.md)

## Important Dates

- **October 2025**: New API announced and available
- **January 29, 2026**: Legacy API shutdown announced
- **April 2, 2026**: Legacy API shutdown (DEADLINE)
- **Before April 2, 2026**: Complete migration

---

**Last Updated**: February 18, 2026
**Version**: 1.0

# GitHub Copilot Metrics API Migration Design

## Executive Summary

This document outlines the architectural design for migrating the GitHub Copilot Metrics Viewer from the legacy synchronous Copilot Metrics API (shutting down April 2, 2026) to the new asynchronous file-based Copilot Usage Metrics API.

**Status**: Design Proposal - Implementation NOT Started

**Date**: February 2026

## Current Architecture Analysis

### Current System Overview

The application currently operates as a **stateless web application** with the following characteristics:

1. **API Integration**
   - Direct synchronous calls to GitHub REST API endpoints
   - Endpoints: `/orgs/{org}/copilot/metrics`, `/enterprises/{ent}/copilot/metrics`
   - Real-time data fetching with 5-minute in-memory caching
   - Support for date range queries (up to 100 days)

2. **Key Components**
   - `server/api/metrics.ts` - Main API handler
   - `shared/utils/metrics-util.ts` - Data fetching and caching logic
   - `app/model/Copilot_Metrics.ts` - TypeScript data models for current API schema
   - `app/model/Options.ts` - URL construction and scope management

3. **Current Data Flow**
   ```
   User Request → API Handler → GitHub API (sync) → Cache (5 min) → Response
   ```

4. **Authentication**
   - Personal Access Tokens (PAT) or GitHub OAuth
   - Token scopes: `copilot`, `manage_billing:copilot`, `read:enterprise`, `read:org`

## New API Requirements

### GitHub Copilot Usage Metrics API Changes

1. **Async File Download Model**
   - Endpoint pattern: `/enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day?day=YYYY-MM-DD`
   - Returns signed download URLs (time-limited)
   - Reports generated daily as NDJSON files
   - Historical data available up to 1 year

2. **Data Format Changes**
   - NDJSON (Newline Delimited JSON) format
   - Similar schema to current API but may have differences
   - Each line represents one day's metrics

3. **Scope Requirements**
   - Enterprise: `/enterprises/{enterprise}/copilot/metrics/reports/enterprise-1-day`
   - Organization: `/orgs/{org}/copilot/metrics/reports/organization-1-day`
   - Must enable "Copilot usage metrics" policy

4. **Authentication**
   - Same token scopes: `manage_billing:copilot` or `read:enterprise`
   - OAuth apps or fine-grained access tokens supported

## Proposed Architecture

### High-Level Architecture Decision

**Recommendation**: Implement a **hybrid architecture** with two modes of operation:

1. **Single-Day Mode (Stateless)** - For quick queries of recent data
2. **Historical Mode (Stateful)** - For analyzing trends and historical data

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Nuxt 3)                        │
│              (No changes - existing UI components)              │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API Layer (server/api/)                      │
│  ┌──────────────────────┐        ┌──────────────────────────┐  │
│  │   metrics.ts         │        │   metrics-historical.ts  │  │
│  │  (Single day/week)   │        │   (Date range queries)   │  │
│  └──────────────────────┘        └──────────────────────────┘  │
└──────────┬──────────────────────────────────┬──────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐    ┌────────────────────────────────┐
│  GitHub API Service      │    │   Database Service             │
│  (New Async Download)    │    │   (PostgreSQL)                 │
│                          │    │                                │
│  - Request download URL  │◄───│  - Store daily metrics         │
│  - Download NDJSON file  │───►│  - Query aggregations          │
│  - Parse and transform   │    │  - Handle date ranges          │
└──────────────────────────┘    └────────────────────────────────┘
           │                                  │
           ▼                                  ▼
┌──────────────────────────┐    ┌────────────────────────────────┐
│   Background Job         │    │   Data Models                  │
│   (Optional Scheduler)   │    │                                │
│                          │    │  - metrics_daily               │
│  - Daily data sync       │    │  - metrics_seats               │
│  - Gap detection         │    │  - sync_status                 │
│  - Retry failed fetches  │    │                                │
└──────────────────────────┘    └────────────────────────────────┘
```

## Database Design

### Storage Abstraction with Nitro Unstorage

**Design Decision**: Use Nitro's [unstorage](https://unstorage.unjs.io/) abstraction layer for all persistence operations.

#### Why Unstorage?

1. **Database Agnostic** - Unified API works with PostgreSQL, Redis, MongoDB, filesystem, and more
2. **Already in Codebase** - Existing TODO comment in `server/api/metrics.ts:5` references unstorage
3. **Flexible Deployment** - Users can choose their preferred storage backend
4. **Simple Configuration** - Change database by updating `nuxt.config.ts`, no code changes needed
5. **Development Friendly** - Use filesystem or memory storage for local dev, production DB for deployment

#### Storage Implementation Approach

```typescript
// server/storage/metrics-storage.ts
// Abstract interface - storage-agnostic
export interface MetricsStorage {
  saveMetrics(key: string, data: MetricsData): Promise<void>;
  getMetrics(key: string): Promise<MetricsData | null>;
  queryMetricsByDateRange(scope: string, startDate: string, endDate: string): Promise<MetricsData[]>;
  // ... other methods
}

// Implementation uses Nitro's useStorage()
export function createMetricsStorage(): MetricsStorage {
  const storage = useStorage('metrics'); // Configured in nuxt.config.ts
  return {
    async saveMetrics(key, data) {
      await storage.setItem(key, data);
    },
    // ... other implementations
  };
}
```

#### Supported Storage Backends

Users can configure any unstorage driver in `nuxt.config.ts`:

```typescript
export default defineNuxtConfig({
  nitro: {
    storage: {
      metrics: {
        driver: 'postgresql',  // or 'redis', 'mongodb', 'fs', etc.
        connectionString: process.env.DATABASE_URL
      }
    }
  }
})
```

**Recommended Backends**:
- **PostgreSQL** (recommended): Best for relational queries and JSONB support
- **MongoDB**: Good for document-style storage
- **Redis**: Fast for caching, less suitable for complex queries
- **Filesystem**: Development and single-server deployments
- **Cloudflare D1/KV**: Serverless deployments

### Why PostgreSQL (Default Recommendation)?

While the implementation supports multiple backends via unstorage, PostgreSQL is the recommended default:

1. **Excellent JSON Support** - Native JSON/JSONB types for storing complex metrics
2. **Time-Series Capabilities** - Built-in date/time functions and indexing
3. **ACID Compliance** - Ensures data integrity
4. **Complex Queries** - SQL joins and aggregations for analytics
5. **Wide Deployment Support** - Available in most cloud providers and on-premises
6. **Open Source** - No licensing costs

**Note**: While unstorage provides abstraction, PostgreSQL's advanced features (JSONB indexes, complex queries) make it the optimal choice for this use case. Other backends may require additional abstraction layers for equivalent functionality.

### Database Schema

The following schema is designed for PostgreSQL but the storage interface abstracts implementation details:

```sql
-- Main metrics table (stores daily aggregated metrics)
CREATE TABLE copilot_metrics_daily (
    id SERIAL PRIMARY KEY,
    
    -- Identification
    scope VARCHAR(50) NOT NULL, -- 'organization', 'enterprise', 'team-organization', 'team-enterprise'
    scope_identifier VARCHAR(255) NOT NULL, -- org name or enterprise slug
    team_slug VARCHAR(255), -- team slug if applicable
    
    -- Date
    metrics_date DATE NOT NULL,
    
    -- Raw data (JSONB for flexibility)
    metrics_data JSONB NOT NULL,
    
    -- Extracted key metrics (for fast queries without JSON parsing)
    total_active_users INTEGER DEFAULT 0,
    total_engaged_users INTEGER DEFAULT 0,
    total_code_suggestions INTEGER DEFAULT 0,
    total_code_acceptances INTEGER DEFAULT 0,
    total_code_lines_suggested INTEGER DEFAULT 0,
    total_code_lines_accepted INTEGER DEFAULT 0,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure one record per day per scope
    CONSTRAINT unique_daily_metrics UNIQUE (scope, scope_identifier, team_slug, metrics_date)
);

-- Indexes for common queries
CREATE INDEX idx_metrics_scope_date ON copilot_metrics_daily(scope, scope_identifier, metrics_date DESC);
CREATE INDEX idx_metrics_date ON copilot_metrics_daily(metrics_date DESC);
CREATE INDEX idx_metrics_scope_team ON copilot_metrics_daily(scope, scope_identifier, team_slug, metrics_date DESC);

-- GIN index for JSONB queries
CREATE INDEX idx_metrics_jsonb ON copilot_metrics_daily USING GIN (metrics_data);

-- Seats data table (current seats information)
CREATE TABLE copilot_seats (
    id SERIAL PRIMARY KEY,
    
    -- Identification
    scope VARCHAR(50) NOT NULL,
    scope_identifier VARCHAR(255) NOT NULL,
    
    -- User information
    user_id INTEGER NOT NULL,
    user_login VARCHAR(255) NOT NULL,
    
    -- Seat details (JSONB for full GitHub API response)
    seat_data JSONB NOT NULL,
    
    -- Extracted fields
    last_activity_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL,
    
    -- Snapshot metadata
    snapshot_date DATE NOT NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- One record per user per scope per day
    CONSTRAINT unique_seat_snapshot UNIQUE (scope, scope_identifier, user_id, snapshot_date)
);

CREATE INDEX idx_seats_scope_date ON copilot_seats(scope, scope_identifier, snapshot_date DESC);
CREATE INDEX idx_seats_user ON copilot_seats(user_id, snapshot_date DESC);
CREATE INDEX idx_seats_activity ON copilot_seats(last_activity_at DESC);

-- Sync status table (tracks data sync progress)
CREATE TABLE sync_status (
    id SERIAL PRIMARY KEY,
    
    -- Scope identification
    scope VARCHAR(50) NOT NULL,
    scope_identifier VARCHAR(255) NOT NULL,
    team_slug VARCHAR(255),
    
    -- Date being synced
    metrics_date DATE NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL, -- 'pending', 'in_progress', 'completed', 'failed'
    error_message TEXT,
    
    -- Attempt tracking
    attempt_count INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMP,
    
    -- Completion tracking
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_sync_status UNIQUE (scope, scope_identifier, team_slug, metrics_date)
);

CREATE INDEX idx_sync_status ON sync_status(scope, scope_identifier, status, metrics_date DESC);
```

## Implementation Phases

### Phase 1: Storage Infrastructure (Week 1-2)

**Goals**: Set up storage abstraction and data access layer using Nitro's unstorage

**Tasks**:
1. Configure Nitro storage with unstorage drivers
2. Implement storage abstraction layer (database-agnostic)
3. Create storage interface for metrics, seats, and sync status
4. Implement PostgreSQL-specific optimizations (indexes, JSONB queries)
5. Add configuration examples for multiple storage backends
6. Add database configuration to `.env` and documentation

**Deliverables**:
- `server/storage/metrics-storage.ts` - Storage abstraction interface
- `server/storage/adapters/postgresql.ts` - PostgreSQL-specific implementation (optional optimizations)
- `nuxt.config.ts` - Storage configuration examples
- `server/utils/storage-factory.ts` - Factory for creating storage instances
- Updated `.env.example` with storage configuration
- Documentation for configuring different storage backends

**Storage Configuration Example**:
```typescript
// nuxt.config.ts
export default defineNuxtConfig({
  nitro: {
    storage: {
      // Metrics data storage
      metrics: {
        driver: 'postgresql',
        connectionString: process.env.DATABASE_URL
      },
      // Alternative: Filesystem for development
      // metrics: {
      //   driver: 'fs',
      //   base: './data/metrics'
      // },
      // Alternative: Redis for caching
      // metrics: {
      //   driver: 'redis',
      //   url: process.env.REDIS_URL
      // }
    }
  }
})
```

### Phase 2: New API Integration (Week 3-4)

**Goals**: Integrate with new GitHub Copilot Usage Metrics API

**Tasks**:
1. Create service for new API endpoints
2. Implement download URL request
3. Implement NDJSON file download and parsing
4. Create data transformation layer (NDJSON → Database model)
5. Handle signed URL expiration and retries

**Deliverables**:
- `server/services/github-copilot-api.ts` - New API client
- `server/services/ndjson-parser.ts` - NDJSON parsing utility
- `server/services/data-transformer.ts` - Transform new API schema to DB model
- `shared/utils/metrics-util-v2.ts` - New metrics utility for async operations

### Phase 3: Data Sync Service (Week 5-6)

**Goals**: Implement background data synchronization

**Tasks**:
1. Create data sync service for daily metrics
2. Implement gap detection (missing dates)
3. Add error handling and retry logic
4. Create admin endpoint for manual sync trigger
5. Implement sync status monitoring

**Deliverables**:
- `server/services/sync-service.ts` - Main sync orchestrator
- `server/api/admin/sync.ts` - Manual sync trigger endpoint
- `server/api/admin/sync-status.ts` - Sync status monitoring

### Phase 4: API Layer Updates (Week 7-8)

**Goals**: Update API endpoints to use database

**Tasks**:
1. Update `/api/metrics` to support both modes:
   - Direct API call for single-day queries (backward compatible)
   - Database query for date ranges
2. Add new endpoint `/api/metrics/historical` for explicit historical queries
3. Update seats endpoint to optionally use database
4. Maintain backward compatibility with existing frontend

**Deliverables**:
- Updated `server/api/metrics.ts`
- New `server/api/metrics/historical.ts`
- Updated `server/api/seats.ts`
- Backward compatibility maintained

### Phase 5: Background Job Scheduler (Week 9-10)

**Goals**: Automate daily data synchronization

**Deployment Options**:

The sync service can be deployed in two architectures:

#### Option A: Integrated Sync (Simpler, Recommended for MVP)

Sync runs as part of the main Nuxt application using Nitro's scheduled tasks:

```typescript
// server/tasks/daily-sync.ts
export default defineTask({
  meta: {
    name: 'daily-sync',
    description: 'Sync Copilot metrics daily',
    schedule: '0 2 * * *' // 2 AM daily
  },
  async run() {
    // Sync logic here
  }
})
```

**Pros**:
- Simple deployment (single container)
- No additional infrastructure
- Shared codebase and dependencies

**Cons**:
- Sync job shares resources with web server
- Cannot scale sync independently
- Restart affects both web and sync

#### Option B: Separate Sync Container (Recommended for Production)

Sync runs as an independent container/job, sharing only the storage backend:

**Architecture**:
```
┌─────────────────────┐     ┌─────────────────────┐
│  Web Container      │     │  Sync Container     │
│  (Nuxt App)         │     │  (Sync Job Only)    │
│                     │     │                     │
│  - API endpoints    │     │  - Sync service     │
│  - Frontend         │     │  - Scheduled task   │
│  - No sync logic    │     │  - No web server    │
└──────────┬──────────┘     └──────────┬──────────┘
           │                           │
           └─────────┬─────────────────┘
                     ▼
           ┌─────────────────────┐
           │  Shared Storage     │
           │  (PostgreSQL/etc)   │
           └─────────────────────┘
```

**Implementation**:

1. **Create separate entry point** for sync job:
```typescript
// server/sync-entry.ts
import { runSyncJob } from './services/sync-service';

async function main() {
  console.log('Starting sync job...');
  await runSyncJob();
  console.log('Sync job completed');
  process.exit(0);
}

main().catch((error) => {
  console.error('Sync job failed:', error);
  process.exit(1);
});
```

2. **Dockerfile for sync container**:
```dockerfile
# Dockerfile.sync
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --production

COPY server/services ./server/services
COPY server/storage ./server/storage
COPY server/sync-entry.ts ./server/
COPY shared ./shared

CMD ["node", "server/sync-entry.ts"]
```

3. **Kubernetes CronJob**:
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: copilot-metrics-sync
spec:
  schedule: "0 2 * * *"  # 2 AM daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: sync
            image: copilot-metrics-sync:latest
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
            - name: GITHUB_TOKEN
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: github-token
          restartPolicy: OnFailure
```

4. **Docker Compose (Development)**:
```yaml
# docker-compose.yml
services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/metrics
    depends_on:
      - db
  
  sync:
    build:
      context: .
      dockerfile: Dockerfile.sync
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/metrics
      - GITHUB_TOKEN=${GITHUB_TOKEN}
    depends_on:
      - db
    # Run manually or with cron in production
  
  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=metrics
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

**Pros**:
- **Independent scaling**: Scale web and sync separately
- **Resource isolation**: Sync doesn't impact web performance
- **Better reliability**: Web stays up during sync failures
- **Flexible scheduling**: Use Kubernetes CronJob, GitHub Actions, etc.
- **Easier monitoring**: Separate logs and metrics per service

**Cons**:
- Slightly more complex deployment
- Need to manage two containers
- Shared storage must handle concurrent access

**Recommendation**: Start with Option A (integrated) for MVP, migrate to Option B (separate container) for production deployments.

**Tasks**:
1. Implement sync service core logic (works in both options)
2. Create separate entry point for standalone sync job
3. Add configuration for both deployment modes
4. Create Dockerfile.sync for separate container
5. Document both deployment approaches
6. Implement monitoring and alerting
7. Create health check for sync status

**Deliverables**:
- `server/services/sync-service.ts` - Core sync logic (deployment-agnostic)
- `server/sync-entry.ts` - Standalone entry point for sync container
- `server/tasks/daily-sync.ts` - Integrated Nitro scheduled task
- `Dockerfile.sync` - Container image for sync job
- `k8s/cronjob.yaml` - Kubernetes CronJob example
- `docker-compose.yml` - Development setup with separate containers
- Updated health check endpoints
- Monitoring documentation for both modes

### Phase 6: Testing & Documentation (Week 11-12)

**Goals**: Comprehensive testing and documentation

**Tasks**:
1. Unit tests for new services and repositories
2. Integration tests for API endpoints
3. E2E tests for data sync workflows
4. Update deployment documentation
5. Create migration guide for existing deployments

**Deliverables**:
- Test coverage for new code (>80%)
- Updated `README.md`
- New `MIGRATION_GUIDE.md`
- Updated `DEPLOYMENT.md`
- Database backup and restore procedures

## Data Migration Strategy

### For New Deployments

1. Deploy application with empty database
2. Run initial sync for last 28-90 days
3. Enable daily automatic sync

### For Existing Deployments

1. Database will be empty initially (no historical data)
2. Options for backfilling:
   - **Option A**: Sync only recent data (last 28 days) - Fast
   - **Option B**: Sync last 90 days - Moderate
   - **Option C**: Sync full year - Slow but complete

3. Gradual migration:
   - Deploy new version with database support
   - Continue using direct API calls (backward compatible)
   - Run background sync to populate database
   - Switch to database queries when sufficient data accumulated

## API Compatibility Matrix

| Feature | Current API | New API (Direct) | New API (DB) |
|---------|------------|------------------|--------------|
| Single day query | ✅ | ✅ | ✅ |
| Date range (≤28 days) | ✅ | ❌ (manual iteration) | ✅ |
| Date range (>28 days) | ✅ | ❌ (manual iteration) | ✅ |
| Real-time data | ✅ | ⚠️ (daily lag) | ⚠️ (daily lag) |
| Historical data (>90 days) | ✅ | ⚠️ (complex) | ✅ |
| Team filtering | ✅ | ✅ | ✅ |
| Seats info | ✅ | ✅ | ✅ |
| Response time | Fast | Slow (download) | Fast |

## Configuration Changes

### New Environment Variables

```bash
# Database Configuration (Required for historical mode)
DATABASE_URL=postgresql://user:password@localhost:5432/copilot_metrics
DATABASE_POOL_MIN=2
DATABASE_POOL_MAX=10

# Sync Configuration
SYNC_ENABLED=true  # Enable automatic daily sync
SYNC_SCHEDULE="0 2 * * *"  # Cron expression (2 AM daily)
SYNC_BACKFILL_DAYS=28  # Days to backfill on first run
SYNC_RETENTION_DAYS=365  # Days to keep in database

# Feature Flags
ENABLE_HISTORICAL_MODE=true  # Use database for date ranges
DIRECT_API_MAX_DAYS=7  # Max days for direct API calls (without DB)

# Admin API Security
ADMIN_API_SECRET=<random-secret>  # Required for admin endpoints
```

### Updated `.env` File

```bash
# Existing variables (unchanged)
NUXT_PUBLIC_SCOPE=organization
NUXT_PUBLIC_GITHUB_ORG=<org>
NUXT_GITHUB_TOKEN=<token>
NUXT_SESSION_PASSWORD=<32+ chars>

# New variables
DATABASE_URL=postgresql://localhost:5432/copilot_metrics
SYNC_ENABLED=false  # Disable by default
ENABLE_HISTORICAL_MODE=false  # Disable by default (backward compatible)
```

## Deployment Considerations

### Docker Updates

Update `Dockerfile` to:
1. Support PostgreSQL client libraries
2. Run database migrations on startup
3. Optional: Include PostgreSQL in docker-compose for development

### Kubernetes Deployment

Two deployment architectures are supported:

#### Architecture A: Single Container (Simple)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: copilot-metrics-viewer
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: app
        image: copilot-metrics-viewer:latest
        env:
        - name: SYNC_MODE
          value: "integrated"  # Sync runs inside app
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
```

#### Architecture B: Separate Containers (Recommended for Production)

**Main Application Deployment**:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: copilot-metrics-viewer-web
spec:
  replicas: 3  # Scale web independently
  template:
    spec:
      containers:
      - name: web
        image: copilot-metrics-viewer:latest
        env:
        - name: SYNC_MODE
          value: "disabled"  # No sync in web pods
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: app-secrets
              key: database-url
```

**Sync Job as CronJob** (as shown in Phase 5):
```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: copilot-metrics-sync
spec:
  schedule: "0 2 * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: sync
            image: copilot-metrics-sync:latest  # Built from Dockerfile.sync
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: app-secrets
                  key: database-url
          restartPolicy: OnFailure
```

**Benefits of Separate Containers**:
- Web pods can scale horizontally (3+ replicas) without running duplicate sync jobs
- Sync runs independently on schedule, doesn't compete for web resources
- Sync failures don't affect web availability
- Easier to monitor and debug separately

**Database Configuration** (both architectures):
- Deploy PostgreSQL (or use managed service like Azure Database, AWS RDS, GCP Cloud SQL)
- Configure persistent volumes for data
- Set up automated backups
- Store connection string in Kubernetes secrets

### Cloud Provider Options

1. **Azure**
   - Azure Database for PostgreSQL
   - Azure Container Apps
   - Azure Functions (for sync job)

2. **AWS**
   - Amazon RDS PostgreSQL
   - ECS/EKS
   - Lambda (for sync job)

3. **GCP**
   - Cloud SQL PostgreSQL
   - Cloud Run
   - Cloud Scheduler

## Backward Compatibility Plan

### Maintaining Current Behavior

1. **Default Mode**: Application works without database
   - Direct API calls for single-day queries
   - Limited date range support (API-imposed limits)

2. **Opt-in Historical Mode**:
   - Enabled via `ENABLE_HISTORICAL_MODE=true`
   - Requires database configuration
   - Enables extended date ranges

3. **Gradual Migration**:
   - Existing deployments continue to work
   - Add database when ready for historical data
   - No breaking changes to API contracts

## Risk Assessment

### Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Database adds complexity | High | High | Provide docker-compose, clear docs |
| Data sync failures | Medium | Medium | Retry logic, monitoring, manual triggers |
| Schema changes in new API | Medium | Medium | Flexible JSONB storage, transformation layer |
| Performance degradation | Medium | Low | Connection pooling, indexes, caching |
| Migration difficulties | Medium | Medium | Backward compatibility, gradual migration |

### Operational Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|-----------|------------|
| Database maintenance overhead | Medium | High | Use managed services, automation |
| Increased hosting costs | Medium | High | Start with small DB, scale as needed |
| Backup/restore complexity | High | Low | Automated backups, documented procedures |
| Monitoring requirements | Medium | Medium | Health checks, Grafana/Prometheus integration |

## Success Metrics

1. **Functionality**
   - ✅ All current features work with new API
   - ✅ Historical data queries (>100 days) work
   - ✅ No data loss during migration

2. **Performance**
   - ✅ Single-day queries: <500ms (similar to current)
   - ✅ Date range queries: <2s for 90 days
   - ✅ Background sync: Complete daily within 10 minutes

3. **Reliability**
   - ✅ 99.9% uptime (same as current)
   - ✅ Automatic retry on sync failures
   - ✅ Zero data loss

4. **Compatibility**
   - ✅ Existing deployments work without changes
   - ✅ Existing `.env` files compatible
   - ✅ Frontend code unchanged

## Alternative Approaches Considered

### Alternative 1: Serverless File Storage (S3/Blob)

**Approach**: Download NDJSON files daily and store in object storage instead of database.

**Pros**:
- Lower operational complexity than database
- Pay-per-use storage model
- Easy backup/retention

**Cons**:
- ❌ Slow queries (need to scan files)
- ❌ No aggregation capabilities
- ❌ Difficult to query date ranges
- ❌ Complex search/filter logic

**Decision**: Rejected - Poor query performance makes it unsuitable for dashboard use case.

### Alternative 2: Embedded Database (SQLite)

**Approach**: Use SQLite embedded in the application.

**Pros**:
- No separate database server needed
- Simple deployment

**Cons**:
- ❌ Limited concurrency
- ❌ No horizontal scaling
- ❌ File-based storage in containerized environments
- ❌ Backup complexity

**Decision**: Rejected - Does not support multi-instance deployments well.

### Alternative 3: Time-Series Database (InfluxDB/TimescaleDB)

**Approach**: Use specialized time-series database.

**Pros**:
- Optimized for time-series data
- Excellent aggregation performance

**Cons**:
- ❌ Additional dependency to learn
- ❌ TimescaleDB is PostgreSQL extension (acceptable)
- ❌ InfluxDB requires separate infrastructure

**Decision**: Consider TimescaleDB extension for Phase 2 optimization if needed.

### Alternative 4: Keep Current Architecture, Wrapper Approach

**Approach**: Build a wrapper that downloads files and presents same interface as current API.

**Pros**:
- Minimal code changes
- Maintains stateless architecture

**Cons**:
- ❌ Very slow (download files on every request)
- ❌ High GitHub API rate limit usage
- ❌ Poor user experience
- ❌ No historical data beyond 1 year

**Decision**: Rejected - Unacceptable performance and user experience.

## Recommended Path Forward

### Immediate Actions (This Week)

1. **Approve This Design**: Review and approve the overall architecture
2. **Resource Allocation**: Identify team members for implementation
3. **Environment Setup**: Provision PostgreSQL instance for development
4. **Proof of Concept**: Build small PoC of new API integration

### Timeline Summary

- **Phase 1-2**: Weeks 1-4 (Core infrastructure and API integration)
- **Phase 3-4**: Weeks 5-8 (Sync service and API updates)
- **Phase 5-6**: Weeks 9-12 (Automation and testing)
- **Buffer**: Weeks 13-14 (Contingency)

**Total Estimated Time**: 12-14 weeks (3-3.5 months)

**Target Completion**: Before April 2, 2026 (API shutdown)

### Go/No-Go Decision Points

1. **After PoC (Week 2)**: Validate new API works as expected
2. **After Phase 2 (Week 4)**: Confirm data transformation is correct
3. **After Phase 4 (Week 8)**: Validate backward compatibility
4. **After Phase 6 (Week 12)**: Production readiness review

## Open Questions

1. **Q: Should we support multiple database engines (PostgreSQL, MySQL, SQL Server)?**
   - A: Start with PostgreSQL only, add others based on community feedback

2. **Q: What happens to data older than 1 year?**
   - A: GitHub only provides 1 year of historical data. Once synced, we keep it until retention policy deletes it.

3. **Q: Do we need real-time data or is daily acceptable?**
   - A: Daily is acceptable for analytics use case. Real-time not required.

4. **Q: Should sync job be part of main app or separate service?**
   - A: Start with main app (simpler), separate if scaling requires it

5. **Q: How do we handle organizations with thousands of teams?**
   - A: Database design supports it. May need optimization for very large scales.

## Appendix

### A. Example API Request/Response

#### New API Request
```bash
curl -L \
  -H "Accept: application/vnd.github+json" \
  -H "Authorization: Bearer <token>" \
  https://api.github.com/orgs/octo-org/copilot/metrics/reports/organization-1-day?day=2026-02-17
```

#### Response (Download URL)
```json
{
  "download_url": "https://copilot-reports.github.com/signed-url-here?expires=1234567890",
  "expires_at": "2026-02-17T12:00:00Z"
}
```

#### NDJSON File Content (sample)
```json
{"date":"2026-02-17","total_active_users":150,"total_engaged_users":120,"copilot_ide_code_completions":{"total_engaged_users":110,"editors":[...]}}
{"date":"2026-02-16","total_active_users":148,"total_engaged_users":118,"copilot_ide_code_completions":{"total_engaged_users":108,"editors":[...]}}
```

### B. Database Query Examples

#### Get metrics for date range
```sql
SELECT 
  metrics_date,
  total_active_users,
  total_engaged_users,
  metrics_data
FROM copilot_metrics_daily
WHERE scope = 'organization'
  AND scope_identifier = 'octo-org'
  AND metrics_date BETWEEN '2026-01-01' AND '2026-01-31'
ORDER BY metrics_date DESC;
```

#### Get language breakdown over time
```sql
SELECT 
  metrics_date,
  jsonb_path_query(
    metrics_data,
    '$.copilot_ide_code_completions.languages[*]'
  ) as language_data
FROM copilot_metrics_daily
WHERE scope = 'organization'
  AND scope_identifier = 'octo-org'
  AND metrics_date BETWEEN '2026-01-01' AND '2026-01-31';
```

### C. Migration Checklist

For existing deployments migrating to the new system:

- [ ] Review design document and approve architecture
- [ ] Provision PostgreSQL database
- [ ] Update `.env` with database configuration
- [ ] Deploy updated application version
- [ ] Run database migrations
- [ ] Trigger initial data sync (backfill)
- [ ] Verify data accuracy in database
- [ ] Enable historical mode
- [ ] Monitor sync job execution
- [ ] Update monitoring/alerting
- [ ] Document any environment-specific configurations
- [ ] Plan for before April 2, 2026 cutover

---

## Feedback and Questions

Please provide feedback on this design by:
1. Adding comments to this PR
2. Creating issues for specific concerns
3. Discussing in team meetings

**Key areas for feedback**:
- Overall architecture approach
- Database schema design
- Phase timeline and priorities
- Deployment strategy
- Alternative approaches

---

**Document Version**: 1.0
**Last Updated**: February 18, 2026
**Authors**: GitHub Copilot Agent
**Status**: Awaiting Review

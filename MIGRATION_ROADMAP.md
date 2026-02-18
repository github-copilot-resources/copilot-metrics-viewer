# GitHub Copilot Metrics API Migration - Implementation Roadmap

## Overview

This document provides a detailed implementation roadmap for migrating from the legacy GitHub Copilot Metrics API to the new Usage Metrics API. This roadmap is based on the architecture defined in `API_MIGRATION_DESIGN.md`.

**Target Completion**: Before April 2, 2026 (Legacy API Shutdown)

## Timeline Overview

```
┌────────────────────────────────────────────────────────────────────────────┐
│                        12-Week Implementation Timeline                     │
├────────────────────────────────────────────────────────────────────────────┤
│ Week 1-2  │ Phase 1: Database Infrastructure                              │
│ Week 3-4  │ Phase 2: New API Integration                                  │
│ Week 5-6  │ Phase 3: Data Sync Service                                    │
│ Week 7-8  │ Phase 4: API Layer Updates                                    │
│ Week 9-10 │ Phase 5: Background Job Scheduler                             │
│ Week 11-12│ Phase 6: Testing & Documentation                              │
│ Week 13-14│ Buffer & Final Testing                                        │
└────────────────────────────────────────────────────────────────────────────┘
```

## Phase 1: Database Infrastructure (Weeks 1-2)

### Week 1: Database Setup

#### Day 1-2: Database Design & Setup
- [ ] Review and finalize database schema
- [ ] Set up PostgreSQL development environment
- [ ] Create database migration framework
- [ ] Implement connection pooling

**Deliverables**:
- `server/db/schema.sql` - Initial schema
- `server/db/connection.ts` - Connection pool
- `server/db/migrations/001_initial_schema.sql`

**Files to Create**:
```
server/
  db/
    connection.ts          # Database connection pool setup
    schema.sql            # Complete database schema
    migrations/           # Migration scripts
      001_initial_schema.sql
      002_indexes.sql
```

#### Day 3-5: Repository Pattern Implementation
- [ ] Create base repository interface
- [ ] Implement MetricsRepository class
- [ ] Implement SeatsRepository class
- [ ] Implement SyncRepository class
- [ ] Add unit tests for repositories

**Deliverables**:
- `server/db/repositories/base-repository.ts`
- `server/db/repositories/metrics-repository.ts`
- `server/db/repositories/seats-repository.ts`
- `server/db/repositories/sync-repository.ts`
- `tests/db/repositories/*.spec.ts`

**Key Methods**:
```typescript
// MetricsRepository
- saveMetrics(metrics: MetricsData): Promise<void>
- getMetricsForDate(scope, identifier, date): Promise<MetricsData>
- getMetricsForDateRange(scope, identifier, startDate, endDate): Promise<MetricsData[]>
- getLatestMetrics(scope, identifier): Promise<MetricsData>

// SeatsRepository
- saveSeats(seats: SeatData[]): Promise<void>
- getSeats(scope, identifier, date): Promise<SeatData[]>
- getLatestSeats(scope, identifier): Promise<SeatData[]>

// SyncRepository
- getSyncStatus(scope, identifier, date): Promise<SyncStatus>
- updateSyncStatus(status: SyncStatus): Promise<void>
- getPendingSync(): Promise<SyncStatus[]>
- getFailedSync(): Promise<SyncStatus[]>
```

### Week 2: Configuration & Documentation

#### Day 1-3: Environment Configuration
- [ ] Add database configuration to Nuxt config
- [ ] Create environment variable validation
- [ ] Update `.env.example`
- [ ] Add Docker Compose for local development
- [ ] Create database initialization scripts

**Deliverables**:
- Updated `nuxt.config.ts`
- Updated `.env.example`
- `docker-compose.dev.yml`
- `scripts/init-db.sh`
- Database configuration documentation

#### Day 4-5: Health Checks & Monitoring
- [ ] Add database health check to `/api/ready`
- [ ] Add database connection status to `/api/health`
- [ ] Create database monitoring utilities
- [ ] Add logging for database operations

**Deliverables**:
- Updated `server/api/ready.ts`
- Updated `server/api/health.ts`
- `server/utils/db-health.ts`

## Phase 2: New API Integration (Weeks 3-4)

### Week 3: API Client Implementation

#### Day 1-2: New API Client
- [ ] Create GitHubCopilotUsageMetricsClient class
- [ ] Implement download URL request method
- [ ] Implement NDJSON file download
- [ ] Add retry logic with exponential backoff
- [ ] Add error handling for signed URL expiration

**Deliverables**:
- `server/services/github-copilot-usage-api.ts`
- `server/utils/retry-handler.ts`
- Unit tests

**API Methods**:
```typescript
class GitHubCopilotUsageMetricsClient {
  // Get download URL for a specific day
  async getDownloadUrl(scope, identifier, date): Promise<string>
  
  // Download and parse NDJSON file
  async downloadMetrics(url: string): Promise<RawMetricsData[]>
  
  // Combined method
  async fetchMetricsForDate(scope, identifier, date): Promise<RawMetricsData[]>
}
```

#### Day 3-5: NDJSON Parser & Data Transformer
- [ ] Create NDJSON parser utility
- [ ] Implement data transformation layer
- [ ] Map new API schema to database schema
- [ ] Handle schema variations and nulls
- [ ] Add validation for transformed data

**Deliverables**:
- `server/services/ndjson-parser.ts`
- `server/services/data-transformer.ts`
- `server/services/schema-validator.ts`
- Comprehensive unit tests

### Week 4: Integration Testing

#### Day 1-3: End-to-End API Testing
- [ ] Test download URL request with real API
- [ ] Test NDJSON file download and parsing
- [ ] Verify data transformation correctness
- [ ] Test error scenarios (expired URLs, network errors)
- [ ] Create mock NDJSON files for testing

**Deliverables**:
- `tests/integration/github-api.spec.ts`
- `tests/fixtures/sample-metrics.ndjson`
- Integration test documentation

#### Day 4-5: Data Validation & Quality Checks
- [ ] Compare old vs new API data formats
- [ ] Validate data consistency
- [ ] Create data quality checks
- [ ] Document any schema differences

**Deliverables**:
- Data comparison report
- Schema mapping documentation
- `server/utils/data-quality-checker.ts`

## Phase 3: Data Sync Service (Weeks 5-6)

### Week 5: Core Sync Service

#### Day 1-3: Sync Service Implementation
- [ ] Create main SyncService class
- [ ] Implement single-day sync method
- [ ] Implement date range sync method
- [ ] Add transaction support for atomic operations
- [ ] Implement gap detection logic

**Deliverables**:
- `server/services/sync-service.ts`
- `server/services/gap-detector.ts`
- Unit tests

**Sync Service Methods**:
```typescript
class SyncService {
  // Sync metrics for a single day
  async syncMetricsForDate(scope, identifier, date): Promise<void>
  
  // Sync metrics for a date range
  async syncMetricsForDateRange(scope, identifier, startDate, endDate): Promise<void>
  
  // Detect and sync missing dates
  async syncGaps(scope, identifier): Promise<void>
  
  // Get sync statistics
  async getSyncStats(scope, identifier): Promise<SyncStats>
}
```

#### Day 4-5: Error Handling & Retry Logic
- [ ] Implement exponential backoff for retries
- [ ] Add rate limit handling
- [ ] Create error recovery strategies
- [ ] Add detailed error logging
- [ ] Implement circuit breaker pattern

**Deliverables**:
- `server/services/error-handler.ts`
- `server/services/circuit-breaker.ts`
- Error handling documentation

### Week 6: Admin APIs & Monitoring

#### Day 1-3: Admin Endpoints
- [ ] Create `/api/admin/sync` endpoint (manual trigger)
- [ ] Create `/api/admin/sync-status` endpoint (status monitoring)
- [ ] Add authentication for admin endpoints
- [ ] Create sync progress tracking
- [ ] Add ability to cancel ongoing sync

**Deliverables**:
- `server/api/admin/sync.ts`
- `server/api/admin/sync-status.ts`
- `server/middleware/admin-auth.ts`
- Admin API documentation

#### Day 4-5: Monitoring Dashboard
- [ ] Create sync status UI component
- [ ] Add real-time progress updates
- [ ] Create sync history view
- [ ] Add error log viewer
- [ ] Implement sync controls (start, stop, retry)

**Deliverables**:
- `app/pages/admin/sync.vue`
- `app/components/SyncMonitor.vue`
- Admin documentation

## Phase 4: API Layer Updates (Weeks 7-8)

### Week 7: Backward Compatible API Updates

#### Day 1-3: Update Metrics Endpoint
- [ ] Update `/api/metrics` to detect query type
- [ ] Route single-day queries to new or old API
- [ ] Route date range queries to database
- [ ] Maintain response format compatibility
- [ ] Add feature flag for gradual rollout

**Deliverables**:
- Updated `server/api/metrics.ts`
- Routing logic implementation
- Integration tests

**Logic Flow**:
```typescript
// Pseudo-code for routing logic
if (ENABLE_HISTORICAL_MODE && dateRange > 7 days) {
  // Use database
  return await metricsRepository.getMetricsForDateRange(...)
} else if (singleDay || dateRange <= 7 days) {
  // Use new API directly
  return await githubApiClient.fetchMetricsForDate(...)
} else {
  // Fallback to error or limited response
  throw new Error('Historical mode not enabled')
}
```

#### Day 4-5: Add Historical Endpoint
- [ ] Create new `/api/metrics/historical` endpoint
- [ ] Implement advanced query capabilities
- [ ] Add aggregation functions
- [ ] Support filtering and grouping
- [ ] Add pagination for large results

**Deliverables**:
- `server/api/metrics/historical.ts`
- Query builder utility
- API documentation

### Week 8: Seats API & Testing

#### Day 1-2: Update Seats Endpoint
- [ ] Update `/api/seats` to use database option
- [ ] Add snapshot date parameter
- [ ] Maintain backward compatibility
- [ ] Add historical seat data queries

**Deliverables**:
- Updated `server/api/seats.ts`
- Integration tests

#### Day 3-5: Comprehensive API Testing
- [ ] Test all API endpoints with database
- [ ] Test backward compatibility
- [ ] Test feature flag toggling
- [ ] Load testing for database queries
- [ ] Performance benchmarking

**Deliverables**:
- Comprehensive API test suite
- Performance benchmarks
- Load testing report

## Phase 5: Background Job Scheduler (Weeks 9-10)

### Week 9: Scheduler Implementation

#### Day 1-3: Nitro Scheduled Task
- [ ] Create scheduled task for daily sync
- [ ] Implement task configuration
- [ ] Add schedule parsing (cron format)
- [ ] Implement task locking (prevent overlaps)
- [ ] Add task monitoring and logging

**Deliverables**:
- `server/tasks/daily-sync.ts`
- Task configuration in `nuxt.config.ts`
- Task management utilities

**Scheduled Task Logic**:
```typescript
// Daily sync task
export default defineTask({
  meta: {
    name: 'daily-sync',
    description: 'Sync Copilot metrics daily',
    schedule: process.env.SYNC_SCHEDULE || '0 2 * * *' // 2 AM daily
  },
  async run() {
    // Get all scopes to sync
    // For each scope, sync yesterday's data
    // Update sync status
    // Log results
  }
})
```

#### Day 4-5: Alternative Scheduler Options
- [ ] Document Kubernetes CronJob approach
- [ ] Document GitHub Actions approach
- [ ] Document cloud-specific schedulers
- [ ] Create deployment examples

**Deliverables**:
- Kubernetes CronJob YAML template
- GitHub Actions workflow example
- Azure Functions example
- AWS Lambda example

### Week 10: Monitoring & Alerting

#### Day 1-3: Health Checks
- [ ] Add sync health check to `/api/health`
- [ ] Add last sync time tracking
- [ ] Implement sync failure alerts
- [ ] Add metrics for monitoring (Prometheus format)
- [ ] Create Grafana dashboard template

**Deliverables**:
- Updated health check endpoints
- `server/api/metrics-prometheus.ts`
- Grafana dashboard JSON
- Monitoring documentation

#### Day 4-5: Alerting System
- [ ] Implement webhook notifications
- [ ] Add email notifications (optional)
- [ ] Create alert rules
- [ ] Add alert escalation
- [ ] Test alerting scenarios

**Deliverables**:
- `server/services/alert-service.ts`
- Alert configuration
- Alerting documentation

## Phase 6: Testing & Documentation (Weeks 11-12)

### Week 11: Comprehensive Testing

#### Day 1-2: Unit Test Coverage
- [ ] Ensure >80% code coverage
- [ ] Add missing unit tests
- [ ] Fix failing tests
- [ ] Add edge case tests

**Test Coverage Goals**:
- Database repositories: 90%
- API services: 85%
- API endpoints: 80%
- Utilities: 85%

#### Day 3-4: Integration Testing
- [ ] End-to-end sync workflow tests
- [ ] Multi-scope testing
- [ ] Error scenario testing
- [ ] Recovery testing
- [ ] Performance testing

**Deliverables**:
- Comprehensive integration test suite
- Test documentation
- Performance benchmarks

#### Day 5: E2E Testing
- [ ] Update Playwright tests
- [ ] Test UI with database data
- [ ] Test admin panel
- [ ] Test sync monitoring
- [ ] Cross-browser testing

**Deliverables**:
- Updated E2E test suite
- Test reports

### Week 12: Documentation & Release Prep

#### Day 1-2: User Documentation
- [ ] Update README.md
- [ ] Create MIGRATION_GUIDE.md
- [ ] Update DEPLOYMENT.md
- [ ] Create DATABASE_MANAGEMENT.md
- [ ] Create TROUBLESHOOTING.md

**Documentation Updates**:
- Database setup instructions
- Migration steps for existing deployments
- Configuration reference
- API documentation updates
- Admin panel usage guide

#### Day 3-4: Deployment Preparation
- [ ] Create deployment checklist
- [ ] Prepare Docker images
- [ ] Create Kubernetes manifests
- [ ] Update Azure deployment config
- [ ] Create rollback plan

**Deliverables**:
- Deployment checklist
- Updated deployment configs
- Rollback procedures

#### Day 5: Release Notes & Announcement
- [ ] Write release notes
- [ ] Create changelog
- [ ] Prepare announcement
- [ ] Create migration FAQ
- [ ] Plan communication strategy

## Weeks 13-14: Buffer & Final Testing

### Week 13: Production Testing

- [ ] Deploy to staging environment
- [ ] Run full integration tests in staging
- [ ] Perform security audit
- [ ] Load testing with production-like data
- [ ] Verify monitoring and alerting
- [ ] Test backup and restore procedures

### Week 14: Final Preparation & Rollout

- [ ] Address any issues from staging
- [ ] Final documentation review
- [ ] Prepare production deployment plan
- [ ] Schedule deployment window
- [ ] Plan rollout communication
- [ ] Execute deployment
- [ ] Monitor post-deployment
- [ ] Gather feedback

## Pre-Implementation Checklist

Before starting implementation, ensure:

- [ ] Design document reviewed and approved
- [ ] Team members assigned to tasks
- [ ] Development environment ready
- [ ] PostgreSQL instance provisioned
- [ ] GitHub API access verified
- [ ] Timeline approved by stakeholders
- [ ] Resource allocation confirmed

## Risk Mitigation Strategies

### Technical Risks

1. **Database Performance Issues**
   - Mitigation: Start with proper indexing, monitor query performance
   - Fallback: Add caching layer, optimize queries

2. **Data Sync Failures**
   - Mitigation: Robust retry logic, monitoring, manual triggers
   - Fallback: Queue system for reliable processing

3. **API Schema Changes**
   - Mitigation: Flexible JSONB storage, validation layer
   - Fallback: Schema versioning, transformation adapters

### Timeline Risks

1. **Scope Creep**
   - Mitigation: Strict phase boundaries, MVP focus
   - Fallback: Reduce non-critical features

2. **Dependency Delays**
   - Mitigation: 2-week buffer built in
   - Fallback: Parallel workstreams where possible

3. **Resource Availability**
   - Mitigation: Clear assignments, backup resources
   - Fallback: Extend timeline if critical

## Success Criteria

### Phase Completion Criteria

Each phase must meet these criteria before moving to the next:

**Phase 1**: 
- ✅ Database schema created and tested
- ✅ Repositories implemented with >80% test coverage
- ✅ Local development environment working

**Phase 2**:
- ✅ New API integration working
- ✅ Data transformation verified correct
- ✅ Integration tests passing

**Phase 3**:
- ✅ Sync service functional
- ✅ Admin endpoints working
- ✅ Error handling tested

**Phase 4**:
- ✅ API endpoints updated and backward compatible
- ✅ Feature flags working
- ✅ All existing tests passing

**Phase 5**:
- ✅ Scheduled sync working
- ✅ Monitoring in place
- ✅ Alerting tested

**Phase 6**:
- ✅ >80% test coverage achieved
- ✅ Documentation complete
- ✅ Deployment ready

### Final Release Criteria

Before production release:

- [ ] All phases complete and criteria met
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] Documentation reviewed
- [ ] Staging deployment successful
- [ ] Rollback plan tested
- [ ] Team trained on new features
- [ ] Support procedures updated

## Post-Implementation Tasks

### First Week After Release

- [ ] Monitor sync jobs daily
- [ ] Review error logs
- [ ] Gather user feedback
- [ ] Address critical issues immediately
- [ ] Update documentation based on feedback

### First Month After Release

- [ ] Analyze usage patterns
- [ ] Optimize slow queries
- [ ] Review and tune sync schedule
- [ ] Collect performance metrics
- [ ] Plan optimization improvements

### Ongoing Maintenance

- [ ] Monthly database maintenance
- [ ] Quarterly performance review
- [ ] Regular backup testing
- [ ] Monitor disk usage trends
- [ ] Keep dependencies updated

## Communication Plan

### Stakeholder Updates

- **Weekly**: Progress update to team
- **Bi-weekly**: Status report to stakeholders
- **Phase completion**: Detailed phase report
- **Issues**: Immediate escalation for blockers

### Community Communication

- **Pre-release**: Migration guide published
- **Beta**: Call for testers
- **Release**: Announcement with migration instructions
- **Post-release**: FAQ updates based on feedback

## Dependencies

### External Dependencies

- PostgreSQL 12+ (database)
- Node.js 20+ (runtime)
- GitHub API access (new endpoints)
- npm packages: `pg`, `pg-pool`, etc.

### Internal Dependencies

- Nuxt 3 framework
- Existing authentication system
- Current API structure
- Vue.js components

## Contingency Plans

### If Timeline Slips

1. **2-week delay**: Use buffer time, maintain April 2 deadline
2. **4-week delay**: Deploy MVP without all features
3. **>4-week delay**: Emergency fallback plan (see below)

### Emergency Fallback Plan

If migration cannot complete before April 2, 2026:

1. **Option A**: Stateless wrapper (poor performance, but functional)
2. **Option B**: Download and cache last N days only
3. **Option C**: Maintain fork of old API simulation layer

### Critical Failure Scenarios

**Scenario**: New API doesn't work as documented
- **Response**: Document differences, adapt transformation layer
- **Escalation**: Contact GitHub Support

**Scenario**: Performance is unacceptable
- **Response**: Add caching, optimize queries, consider read replicas
- **Escalation**: Architecture review with team

**Scenario**: Data loss during migration
- **Response**: Restore from backup, re-sync from GitHub
- **Escalation**: Halt deployment, investigate thoroughly

## Resources & References

### Documentation
- [API_MIGRATION_DESIGN.md](./API_MIGRATION_DESIGN.md) - Architecture design
- [GitHub Copilot Usage Metrics API Docs](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

### Tools
- Nuxt 3: https://nuxt.com/
- PostgreSQL: https://www.postgresql.org/
- Vitest: https://vitest.dev/
- Playwright: https://playwright.dev/

### Support
- GitHub Issues: Report bugs and issues
- Team Chat: Daily coordination
- Documentation: In-repo markdown files

---

**Document Version**: 1.0
**Last Updated**: February 18, 2026
**Status**: Awaiting Approval

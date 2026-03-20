# Changelog

All notable changes to the Copilot Metrics Viewer will be documented in this file.

## [3.0.0] - 2026-03-20

### ⚠️ Breaking Changes

- **New Copilot Usage Metrics API is now the default.** The application uses GitHub's new download-based Copilot Usage Metrics API instead of the deprecated synchronous REST API. Set `USE_LEGACY_API=true` to opt back into the deprecated API (sunset: April 2, 2026).
- **GitHub App permission update required.** The new API requires the **"Organization Copilot metrics: Read"** permission on your GitHub App. Classic PATs need the `read:org` scope. Update your GitHub App at Settings → Developer settings → GitHub Apps → Permissions.
- **PostgreSQL required for historical mode.** The `ENABLE_HISTORICAL_MODE=true` feature requires a PostgreSQL database configured via `DATABASE_URL`.
- **Environment variable renamed.** `USE_NEW_API` / `COPILOT_METRICS_API` replaced with `USE_LEGACY_API` (inverted logic — new API is now the default).
- **Sync service is a separate container.** Background metrics syncing runs as a standalone container (`Dockerfile.sync`) or Kubernetes CronJob rather than being embedded in the web application.

### Added

- **New Copilot Usage Metrics API client** — Full implementation of GitHub's download-based API with signed URL handling and report parsing (`server/services/github-copilot-usage-api.ts`).
- **Report transformer** — Converts new API response format to the existing frontend data model (`server/services/report-transformer.ts`).
- **PostgreSQL storage layer** — Persistent metrics storage with schema auto-initialization and retry logic (`server/storage/`).
- **Sync service** — Background data synchronization with gap detection, backfill, and date-range support (`server/services/sync-service.ts`).
- **Standalone sync container** — Lightweight Docker image for scheduled sync (`Dockerfile.sync`, `server/sync-entry.ts`).
- **Scheduled sync task** — Nitro scheduled task for integrated sync mode (`server/tasks/daily-sync.ts`).
- **Admin API endpoints** — Manual sync trigger (`POST /api/admin/sync`) and sync status (`GET /api/admin/sync-status`).
- **Historical mode** — Query metrics from PostgreSQL with automatic sync-on-miss fallback (`ENABLE_HISTORICAL_MODE=true`).
- **Redesigned github.com tab** — Updated to display model breakdowns and feature-level data from the new API.
- **Agent and PR dashboards** — New dashboard views for Copilot agent activity and pull request summaries.
- **Real API mock data** — Mock data files based on actual new API responses for realistic testing.
- **Kubernetes manifests** — Deployment and CronJob configurations (`k8s/deployment.yaml`, `k8s/cronjob.yaml`).
- **Docker Compose** — Full local development setup with PostgreSQL, sync, and Playwright services.
- **Azure deployment templates** — Updated ARM templates and Bicep modules with PostgreSQL and sync job resources.

### Fixed

- Lines acceptance rate no longer inflated by agent_edit LOC (was showing 548%, now ~36%).
- Chat active users count was always 0 — now correctly aggregated from new API data.
- Chat acceptances now include code actions from all features.
- Seats endpoint returns empty array in historical mode without auth instead of failing.
- Auth middleware excludes `/api/_auth/` routes to prevent OAuth flow interference.
- PostgreSQL schema initialization retries with exponential backoff on startup.

### Changed

- Default API mode switched from legacy to new Copilot Usage Metrics API.
- Mock mode now routes through the new API transformer for consistent data shapes.
- E2E tests updated with value assertions against transformed mock data.

### Security

- Patched CVE-2026-29063 prototype pollution in immutable dependency.
- Updated undici to >=7.24.4.
- Admin endpoints (`/api/admin/*`) are **not authenticated by default** — secure via reverse proxy, API gateway, or firewall.

### Deployment

- **New environment variables:**
  - `USE_LEGACY_API` — Set to `true` to use deprecated API (default: `false`)
  - `ENABLE_HISTORICAL_MODE` — Enable PostgreSQL-backed queries (default: `false`)
  - `DATABASE_URL` — PostgreSQL connection string (required for historical mode)
  - `SYNC_ENABLED` — Enable built-in scheduled sync (default: `false`)
  - `SYNC_SCHEDULE` — Cron expression for sync schedule (default: `0 2 * * *`)
  - `SYNC_BACKFILL_DAYS` — Days to backfill on first sync (default: `28`)
  - `SYNC_DAYS_BACK` — Days to sync per run (default: `1`)

## [2.1.0] and earlier

See [GitHub Releases](https://github.com/github-copilot-resources/copilot-metrics-viewer/releases) for previous versions.

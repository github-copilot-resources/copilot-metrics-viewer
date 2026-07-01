_NOTE: For information on support and assistance, click [here](https://github.com/github-copilot-resources/copilot-metrics-viewer/tree/main?tab=readme-ov-file#support)._

> **ℹ️ v3.0 — New Copilot Usage Metrics API**
>
> As of v3.0, Copilot Metrics Viewer uses the [Copilot Usage Metrics API](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics). The legacy Copilot Metrics API was shut down on April 2, 2026 and is no longer available.
>
> **What's new in v3.0:**
> - Uses the async Copilot Usage Metrics API for all data
> - **Historical mode** with PostgreSQL for data beyond the 28-day rolling window
> - **Per-user metrics** tab with individual usage breakdowns
> - **Team metrics derived from per-user data** — no longer requires the deprecated team-level API endpoints
> - Sync service for automated daily data collection
>
> Your GitHub App needs **"Organization Copilot metrics: Read"** permission. See [GitHub App Registration](./DEPLOYMENT.md#github-app-registration) for setup details.

# GitHub Copilot Metrics Viewer
<p align="center">
  <img width="150" alt="image" src="https://github.com/github-copilot-resources/copilot-metrics-viewer/assets/3329307/8473a694-217e-4aa2-a3c7-2222a321c336">
</p>

This application displays a set of charts with various metrics related to GitHub Copilot for your <i>GitHub Organization</i> or <i>Enterprise Account</i>. These visualizations are designed to provide clear representations of the data, making it easy to understand and analyze the impact and adoption of GitHub Copilot. 

## Operating Modes

The application supports two operating modes:

| Mode | Description | Requirements | Team Metrics | Data Retention |
|------|-------------|--------------|--------------|----------------|
| **Direct API** | Fetches metrics directly from GitHub's API on each page load | GitHub token only | ❌ Not available | Rolling 28 days |
| **Historical Mode** | Reads from a local PostgreSQL database, synced daily | PostgreSQL + Sync service | ✅ Full history | Unlimited |

**Direct API mode** is the simplest setup — no database required. It returns the latest 28-day rolling window of data from the [Copilot Usage Metrics API](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics). Team-scoped views are not available in this mode because team metrics are derived from per-user records stored in the database.

**Historical mode** adds a PostgreSQL database and a sync service that downloads metrics daily. This enables:
- Viewing metrics **beyond the 28-day API window**
- **Per-user time-series history** with trend charts
- **Team metrics** — derived from stored per-user data filtered by team membership

See [DEPLOYMENT.md](./DEPLOYMENT.md) for setup instructions for each mode.

## Application Overview

The GitHub Copilot Metrics Viewer provides comprehensive analytics through an intuitive dashboard interface:

<p align="center">
  <img width="800" alt="Main Dashboard Overview" src="./images/main-metrics-dashboard.png">
</p>

## New Features

### Date Range Filtering (up to 100 days)
Users can now filter metrics for custom date ranges up to 100 days, with an intuitive calendar picker interface. The system also supports excluding weekends and holidays from calculations.

<p align="center">
  <img width="800" alt="Date Range Filter" src="./images/date-range-filter.png">
</p>

### Teams Tab
Select **one team** for a full deep-dive view with KPI tiles, time-series charts (acceptance rate, active users, feature usage, model usage), language and editor breakdowns, and a per-user activity table. Select **two or more teams** to compare them side by side.

> [!NOTE]
> GitHub's Copilot Usage Metrics API does not provide team-level endpoints. Team metrics are **derived** by fetching per-user daily metrics from the organization/enterprise endpoint, resolving team membership via the GitHub Teams API, and aggregating per-user data in-memory. This works in both Direct API mode (28-day window) and Historical mode (full history).

**Single team deep dive:**
<p align="center">
  <img width="800" alt="Teams Single Team Deep Dive" src="./images/teams-single-team.png">
</p>

**Multi-team comparison:**
<p align="center">
  <img width="800" alt="Teams Comparison" src="./images/teams-comparison.png">
</p>

#### Team-Scoped Direct URLs

You can link directly to a fully team-scoped dashboard — every tab (IDE metrics, chat, agents, languages, etc.) will automatically filter to that team's members only. A blue banner at the top of the page confirms the active scope and provides a quick link back to the organization view.

```
https://<your-host>/orgs/<org>/teams/<team>
https://<your-host>/enterprises/<enterprise>/teams/<team>
```

Examples:
- `http://localhost:3000/orgs/octo-demo-org/teams/the-a-team`
- `http://localhost:3000/enterprises/octo-demo-ent/teams/the-a-team`
- `http://localhost:3000/orgs/mocked-org/teams/the-a-team?mock=true` _(mock data)_

<p align="center">
  <img width="800" alt="Team-scoped dashboard showing blue banner with team name and Back to Org button" src="./images/team-scoped-dashboard.png">
</p>

### Per-User Metrics
View individual user-level Copilot usage metrics including code completions, chat interactions, and code review activity. Summary tiles show total users, active users, and average acceptance rate.

In **Historical mode** (with PostgreSQL), the User Metrics tab also displays per-user time-series history charts, allowing you to track individual adoption trends over time.

The per-user table includes an **AI Credits** column showing each user's premium-request spend (sourced from the `ai_credits_used` field that GitHub added to the `users-28-day` Copilot metrics report on 2026-06-19). The column shows `—` when GitHub hasn't reported credits for the period (e.g., older mock data or enterprises that haven't enabled premium-request billing).

<p align="center">
  <img width="800" alt="Per-User Metrics" src="./images/user-metrics.png">
</p>

### My Usage Tab
Personal dashboard for the currently-authenticated user. Shows your own active days, interactions, accepted lines, AI credits used, top IDE, and top model — filtered server-side by `session.user.login` so you can never see another user's data from this tab.

Visible to every authenticated user when any auth provider is configured (`NUXT_PUBLIC_AUTH_PROVIDERS`). Hidden when the app is running in PAT-only / no-auth mode, because there is no session user to filter by.

<p align="center">
  <img width="800" alt="My Usage tab — personal AI credit spend, CLI token usage, and daily charts" src="./images/my-usage.png">
</p>

### Billing (admin)
Aggregate AI credit billing breakdown by model, SKU, cost center, and repository — pulled from the GitHub Billing API (`/organizations/{org}/settings/billing/ai_credit/usage` and `/enterprises/{ent}/settings/billing/ai_credit/usage`). Also includes a **per-user breakdown table** that joins the org's user list with each user's billing spend (lazy-loaded one page at a time), with "Top spenders by net cost" and "Top CLI token users" charts.

**Visibility:**
1. **When `NUXT_GITHUB_BILLING_TOKEN` is *not* configured** — the tab is shown to every dashboard user, but renders only a configuration-help placeholder (no data is fetched). This is a discoverability aid so operators learn the feature exists.
2. **When `NUXT_GITHUB_BILLING_TOKEN` *is* configured** — the tab is **admin-only**: visible only to users on the `NUXT_USAGE_ADMINS` allowlist. In PAT-mode deployments (no OAuth provider configured) the allowlist is bypassed and the tab is visible to anyone who can reach the dashboard.

**Why a separate token?** Billing endpoints have stricter auth than metrics endpoints — they require a **classic PAT** with `manage_billing:enterprise` (for enterprise-owned orgs, SSO-authorized for the enterprise if enforced) or `manage_billing:copilot` (for standalone orgs). Fine-grained PATs and GitHub Apps cannot read billing today. Keeping `NUXT_GITHUB_BILLING_TOKEN` separate from `NUXT_GITHUB_TOKEN` means your metrics calls can keep using a GitHub App / fine-grained PAT while only billing uses the classic PAT.

**Which billing endpoint gets called?**

- **Standalone organizations (no parent enterprise):** billing calls go to `/organizations/{org}/settings/billing/ai_credit/usage` automatically — **leave `NUXT_BILLING_ENTERPRISE` unset**. A classic PAT with `manage_billing:copilot` scope is sufficient.
- **Enterprise-owned organizations (org billing consolidated under an enterprise):** the org-level endpoint returns **404** because billing lives at the enterprise level. Set `NUXT_BILLING_ENTERPRISE=<enterprise-slug>` to route billing calls to `/enterprises/{slug}/...` — use a classic PAT with `manage_billing:enterprise` scope, SSO-authorized for that enterprise. Without this override an org-scoped dashboard will see a 404 with a hint pointing at the variable.

Not sure which one applies to you? Call `GET /orgs/<your-org>` and look at the `enterprise` field — `null` means standalone, an object with a `slug` means enterprise-owned (use that slug).

**Per-user attribution caveat:** the per-user breakdown depends on GitHub tagging each billing item with a `user`. Some enterprise plans (typically fully-pooled / centrally-billed) return only enterprise-level aggregates, in which case every user appears at $0 in the per-user table; the Billing tab surfaces an explanatory alert in that state. The My Usage tab and the User Metrics `ai_credits_used` column are independent of this and still work.

#### Admin drill-down — inline User insights per user

Each username in the Per-user breakdown table is a clickable chip. Selecting a chip reveals an inline **User insights** section directly below the table with that user's full Copilot activity report — the same view the user would see on their own My Usage tab (Active days, Interactions, Accepted lines, AI credits used, per-model spend, top IDE / language / model, day-by-day charts).

No user selected → the section shows an info banner explaining the feature. Clicking a chip a second time (or "Clear selection") returns to the banner state.

**Requires** `NUXT_GITHUB_BILLING_TOKEN` (always) and — only for enterprise-owned orgs — `NUXT_BILLING_ENTERPRISE`. Standalone orgs work without the enterprise slug. The drill-down endpoint (`/api/my-usage?login=<other>`) is gated by `NUXT_USAGE_ADMINS`; non-admins receive 403. In PAT-only deployments the operator is admin-by-PAT and the drill-down works without an OAuth session.

![Billing tab — Per-user breakdown with chip-style logins and the info banner state](images/billing-user-insights-banner.png)

![Billing tab — inline User insights section showing a selected user's activity](images/billing-user-insights-selected.png)

#### Billing CSV Ingest (local cache, multi-month windows)

The live billing endpoints cap windows at ~31 days and rate-limit aggressively. For longer historical analysis, the dashboard can pull GitHub's **enterprise billing CSV exports** into a local Postgres table, then serve the Billing tab from the cache.

When the cache covers the selected window, the Billing tab serves data from the DB and shows a small "Source: local cache" chip with the last-synced timestamp. When the window is partially or not covered, it falls back to the live API automatically.

**Triggering an ingest** (admin panel → Billing CSV ingest):
- Pick a date range (defaults to last 30 days through today)
- Leave **"Skip already-ingested ranges"** checked to fetch only the gaps in your selected window — re-running for an overlapping range becomes cheap
- Submit; the job runs in the background, polled by the recent-jobs table

GitHub builds the export server-side and returns one or more signed download URLs (60-minute TTL). The ingester downloads, parses, dedupes by primary key, and bulk-upserts into the `billing_credit_usage` table. Multi-month windows are chunked at ≤31 days internally — you can request months of data in a single click.

The recent-jobs table shows status, row count, who triggered, and a hover tooltip on the row count surfacing **what was fetched vs. skipped** (so you can verify gap-mode actually pruned re-fetches of already-ingested ranges).

**Requires:** an **enterprise-owned org** — the CSV export endpoint (`/enterprises/{slug}/settings/billing/usage_report`) is enterprise-only. Standalone orgs must use the live Billing tab instead. Set `NUXT_GITHUB_BILLING_TOKEN` to a classic PAT with `manage_billing:enterprise` (SSO-authorized if enforced) and `NUXT_BILLING_ENTERPRISE` to the enterprise slug. Postgres must be configured (see the storage section).

![Admin panel — Billing CSV ingest controls](images/billing-csv-ingest.png)

![Billing tab with per-user breakdown sourced from the local cache](images/billing-tab-cache.png)

### My Usage (per-user, self-service)
Personal Copilot activity for the signed-in user only — server-side filtered against the session. Surfaces:
- `ai_credits_used` totals + per-day chart (when a date range is selected)
- **Your AI credit spend** — total $, credits billed, per-model breakdown (requires `NUXT_GITHUB_BILLING_TOKEN`; the call always sends `?user=<session-login>` and is never user-controllable)
- GitHub CLI usage card (sessions, requests, prompt/output token sums, CLI version) when the user has CLI activity
- AI adoption-phase chip and top-IDE/plugin versions

### Models Tab
View model usage analytics including model adoption over time, chat model distribution, and usage per chat mode (Ask, Agent, Edit, Inline).

<p align="center">
  <img width="800" alt="Models Tab" src="./images/models-tab.png">
</p>

### CSV Export Functionality
Export your metrics data in multiple formats for further analysis or reporting. Options include summary reports, full detailed exports, and direct clipboard copying.

<p align="center">
  <img width="800" alt="CSV Export Options" src="./images/csv-export-functionality.png">
</p>

## Charts

## Key Metrics
>[!NOTE]
> Metrics details are described in detail in the [Copilot Usage Metrics API documentation](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage-metrics)

Here are the key metrics visualized in these charts:
<p align="center">
  <img width="800" alt="Key Metrics Overview" src="./images/main-metrics-dashboard.png">
</p>

1. **Active Users Over Time:** Tracks daily, weekly, and monthly active users across all Copilot features — IDE completions, chat, agent mode, CLI, and PR summaries.
<p align="center">
  <img width="800" alt="Active Users Over Time" src="./images/Acceptance_rate_bycount.png">
</p>

2. **Feature Usage Over Time:** Shows user-initiated interactions per feature per day, covering IDE chat, agent mode, edit mode, inline chat, CLI, PR summaries, and more.
<p align="center">
  <img width="800" alt="Feature Usage Over Time" src="./images/Total_suggestions_count.png">
</p>

3. **Code Completions:** Tracks total inline code suggestions shown and accepted over time.

4. **Total Lines Suggested:** Showcases the total number of lines of code suggested by GitHub Copilot. This gives an idea of the volume of code generation and assistance provided.

5. **Total Lines Accepted:** As the name suggests, the total lines of code accepted by users (full acceptances) offering insights into how much of the suggested code is actually being utilized and incorporated into the codebase.
<p align="center">
  <img width="800" alt="image" src="./images/Total Lines.png">
</p>

6. **Total Active Users:** Represents the number of active users engaging with GitHub Copilot. This helps in understanding the user base growth and adoption rate.
<p align="center">
  <img width="800" alt="image" src="./images/Total_Active_users.png">
</p>

## Languages Breakdown Analysis

Pie charts with the top 5 languages by accepted prompts and acceptance rate (by count/by lines) are displayed at the top.
<p align="center">
  <img width="800" alt="Updated Language breakdown with charts and data table" src="./images/languages-breakdown.png">
</p>

The language breakdown analysis tab also displays a table showing the Accepted Prompts, Accepted Lines of Code, and Acceptance Rate (%) for each language over the selected time period. The entries are sorted by the number of _accepted lines of code descending_.

## Copilot Chat Metrics

<p align="center">
  <img width="800" alt="Copilot Chat Metrics Dashboard" src="./images/copilot-chat-metrics.png">
</p>

1. **Cumulative Number of Turns:** This metric represents the total number of turns (interactions) with the Copilot over the selected time period. A 'turn' includes both user inputs and Copilot's responses.

2. **Cumulative Number of Acceptances:** This metric shows the total number of lines of code suggested by Copilot that have been accepted by users over the selected time period.

3. **Total Turns | Total Acceptances Count:** This is a chart that displays the total number of turns and acceptances.

4. **Total Active Copilot Chat Users:** A bar chart that illustrates the total number of users who have actively interacted with Copilot over the selected time period.

## Seat Analysis
<p align="center">
  <img width="800" alt="Seat Analysis Dashboard" src="./images/seat-analysis.png">
</p>

1. **Total Assigned:** This metric represents the total number of Copilot seats assigned within the current organization/enterprise.

2. **Assigned But Never Used:** This metric shows seats that were assigned but never used within the current organization/enterprise. The assigned timestamp is also displayed in the chart.

3. **No Activity in the Last 7 Days:** Never used seats or seats used, but with no activity in the past 7 days.

4. **No Activity in the Last 7 Days (including never used seats):** A table to display seats that have had no activity in the past 7 days, ordered by the date of last activity. Seats that were used earlier are displayed at the top.

## Advanced Features

### Flexible Date Range Selection
The application supports flexible date range selection allowing users to analyze metrics for any period up to 100 days. The date picker provides an intuitive calendar interface with options to exclude weekends and holidays from the analysis.

### Data Export Capabilities
Multiple export options are available in the API Response tab:
- **Download CSV (Summary)**: Exports key metrics in a condensed format
- **Download CSV (Full)**: Exports comprehensive detailed data
- **Copy Metrics to Clipboard**: Quick copy functionality for immediate use
- **Check Metric Data Quality**: Validates data integrity and completeness

### Team Analytics
Organizations can compare metrics across different teams to:
- Identify high-performing teams
- Understand adoption patterns
- Share best practices across teams
- Monitor team-specific engagement levels

> [!NOTE]
> Team metrics are derived from per-user data by resolving GitHub team membership and aggregating. The GitHub Copilot Usage Metrics API does not have dedicated team endpoints — this application computes team views automatically. In Direct API mode, team data covers the latest 28-day window. In Historical mode (with PostgreSQL), full historical team trends are available.

### Model Usage Analytics
Detailed insights into AI model usage including:
- IDE Code Completions by editor and model type
- IDE Chat interactions and model preferences
- GitHub.com Chat usage patterns
- PR Summary generation statistics
- Custom vs. default model adoption rates

## Setup Instructions

In the `.env` file, you can configure several environment variables that control the behavior of the application.

Public variables:
- `NUXT_PUBLIC_IS_DATA_MOCKED`
- `NUXT_PUBLIC_SCOPE`
- `NUXT_PUBLIC_GITHUB_ENT`
- `NUXT_PUBLIC_GITHUB_ORG`
- `NUXT_PUBLIC_HIDDEN_TABS`
- `NUXT_PUBLIC_ENABLE_HISTORICAL_MODE`

can be overridden by route parameters, e.g.
- `http://localhost:3000/enterprises/octo-demo-ent`
- `http://localhost:3000/orgs/octo-demo-org`
- `http://localhost:3000/orgs/octo-demo-org/teams/the-a-team`
- `http://localhost:3000/enterprises/octo-demo-ent/teams/the-a-team`
- `http://localhost:3000/orgs/mocked-org?mock=true`

When navigating to a team-scoped URL, a blue banner appears at the top confirming the active team scope and offering a **Back to org** button. All tabs automatically filter to team members only.

#### NUXT_PUBLIC_SCOPE (Required!)

The `NUXT_PUBLIC_SCOPE` environment variable in the `.env` file determines the default scope of the API calls made by the application. It can be set to `'enterprise'` or `'organization'`.

- If set to `'enterprise'`, the application will target API calls to the GitHub Enterprise account defined in the `NUXT_PUBLIC_GITHUB_ENT` variable.
- If set to `'organization'`, the application will target API calls to the GitHub Organization account defined in the `NUXT_PUBLIC_GITHUB_ORG` variable.
- To view team-level metrics, use the Teams tab or navigate to `/orgs/<org>/teams/<team>` — team filtering is applied as a post-processing step.

> **Note:** Legacy values `'team-organization'` and `'team-enterprise'` are still accepted and automatically normalized to `'organization'` and `'enterprise'` respectively for backward compatibility.

For example, if you want to target the API calls to an organization, you would set `NUXT_PUBLIC_SCOPE=organization` in the `.env` file.

>[!INFO]
> Environment variables with `NUXT_PUBLIC` scope are available in the browser (are public).
> See [Nuxt Runtime Config](https://nuxt.com/docs/guide/going-further/runtime-config) for details.

````
NUXT_PUBLIC_SCOPE=organization

NUXT_PUBLIC_GITHUB_ORG=<YOUR-ORGANIZATION>

NUXT_PUBLIC_GITHUB_ENT=
````

#### NUXT_PUBLIC_IS_DATA_MOCKED

Variable is false by default. To view mocked data switch it to true or use query parameter `?mock=true`.

````
NUXT_PUBLIC_IS_DATA_MOCKED=false
````

#### NUXT_GITHUB_TOKEN

Specifies the GitHub Personal Access Token utilized for **metrics** API requests. Generate this token with the following permissions: _Read access to members_, _organization copilot metrics_, and _organization copilot seat management_.

This token does **not** need billing scopes — billing has its own dedicated token (see `NUXT_GITHUB_BILLING_TOKEN` below). Keeping the two separate means metrics can keep using a fine-grained PAT or GitHub App, while only billing requires a classic PAT.

> [!IMPORTANT]
> **v3.0 Migration:** The new Copilot Usage Metrics API requires **Read access to members, organization copilot metrics, and organization copilot seat management** permissions. Without this, the new API endpoints will return 400/403 errors. See [GitHub App Registration](DEPLOYMENT.md#github-app-registration) for setup details.

Token is not used in the frontend.

````
NUXT_GITHUB_TOKEN=
````

#### NUXT_GITHUB_BILLING_TOKEN

Optional. **Dedicated classic PAT for the Billing tab and per-user AI credit spend.** When unset, the Billing tab is hidden and the "Your AI credit spend" card on the My Usage tab is omitted — all other features keep working.

Requirements:
- **Classic PAT only** — fine-grained PATs and GitHub Apps cannot read billing.
- Scope: **`manage_billing:enterprise`** (or `manage_billing:copilot` for non-enterprise-owned orgs).
- Must be **SSO-authorized** for the target enterprise if SAML SSO is enforced.

````
NUXT_GITHUB_BILLING_TOKEN=ghp_classic_pat_with_manage_billing_enterprise
````

#### NUXT_BILLING_ENTERPRISE

Optional. **Set only when your organization's billing is consolidated under a GitHub enterprise.** When set, it forces billing calls to `/enterprises/{slug}/settings/billing/ai_credit/usage` regardless of the dashboard's scope.

**Leave unset for standalone organizations** — the app will automatically use `/organizations/{org}/settings/billing/ai_credit/usage`, which is the correct endpoint for orgs that aren't part of an enterprise.

To check whether your org is enterprise-owned:

```bash
curl -H "Authorization: token <PAT>" https://api.github.com/orgs/<your-org> | jq '.enterprise'
```

`null` → standalone (leave `NUXT_BILLING_ENTERPRISE` unset); an object with a `slug` → enterprise-owned (use that slug).

````
NUXT_BILLING_ENTERPRISE=my-enterprise-slug
````

If you get a 404 from the Billing tab with the dashboard scoped to an enterprise-owned organization, the error message will point you at this variable.

#### NUXT_GITHUB_API_BASE_URL

Optional. Overrides the GitHub API base URL used for all server-side API calls. Set this when accessing GitHub at **GHE.com** (GitHub Enterprise Cloud with data residency), where the API is available at a dedicated subdomain.

```
NUXT_GITHUB_API_BASE_URL=https://api.SUBDOMAIN.ghe.com
```

Defaults to `https://api.github.com` when not set. Leave unset for standard GitHub.com and GitHub Enterprise Cloud (non-data-residency) deployments.

> [!NOTE]
> **GHES (GitHub Enterprise Server) is not supported** — the Copilot usage metrics API is not available on GHES.

#### NUXT_GITHUB_APP_ID / NUXT_GITHUB_APP_PRIVATE_KEY

**Alternative to PAT** — use a GitHub App installation token for backend data access. When both are set, they take priority over `NUXT_GITHUB_TOKEN`. This is the recommended credential when users authenticate via Google, Microsoft, Auth0, or Keycloak (i.e., non-GitHub identity providers), since the token is machine-issued and not tied to any individual user account.

The installation ID is **auto-discovered** from `NUXT_PUBLIC_GITHUB_ORG` — no manual configuration needed. If the App is installed on multiple orgs and no org is configured, users see an org picker after login.

See [GitHub App Installation Token](DEPLOYMENT.md#github-app-installation-token-no-pat-required) in the deployment guide for full setup instructions.

```bash
NUXT_GITHUB_APP_ID=123456
NUXT_GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
```

#### NUXT_SESSION_PASSWORD (Required!)

This variable is required to encrypt user sessions, it needs to be at least 32 characters long.
For more information see [Nuxt Sessions and Authentication](https://nuxt.com/docs/guide/recipes/sessions-and-authentication#cookie-encryption-key).

>[!WARNING]
> This variable is required starting from version 2.0.0.

#### NUXT_PUBLIC_AUTH_PROVIDERS

Comma-separated list of active OAuth providers: `github`, `google`, `microsoft`, `auth0`, `keycloak`. Setting this variable enables authentication — users must sign in before accessing the dashboard.

```
NUXT_PUBLIC_AUTH_PROVIDERS=github,google
```

The corresponding `NUXT_OAUTH_<PROVIDER>_CLIENT_ID` and `NUXT_OAUTH_<PROVIDER>_CLIENT_SECRET` must also be set. See [Authentication](DEPLOYMENT.md#authentication-1) in DEPLOYMENT.md for full setup instructions per provider.

#### NUXT_AUTHORIZED_USERS

Comma-separated list of logins or email addresses that are allowed to sign in (any provider). When empty (default), all authenticated users are allowed.

```
NUXT_AUTHORIZED_USERS=alice,bob@company.com
```

#### NUXT_AUTHORIZED_EMAIL_DOMAINS

Comma-separated list of email domains allowed to sign in. When empty (default), no domain restriction is applied.

```
NUXT_AUTHORIZED_EMAIL_DOMAINS=company.com
```

#### NUXT_USAGE_ADMINS

Comma-separated allowlist of logins or email addresses that get **administrator privileges** on the dashboard. Administrators can:

* See the **Billing tab** (aggregate AI-credit breakdown by SKU/model/cost-center/repo)
* See **all users' rows** in the User Metrics tab and Seats Analysis
* Query any team on the Teams tab, including enterprise-scope team queries
* Use the `?login=<other-user>` override on `/api/my-usage` and `/api/user-metrics-history`

The gate is **opt-in**: when `NUXT_USAGE_ADMINS` is empty (default), the admin gate is **inactive** and every authenticated caller is treated as an admin — the dashboard behaves as it did before the allowlist was introduced. Populate the variable to enable row-level scoping (e.g. for GDPR / Austrian works-council compliance per [issue #398](https://github.com/github-copilot-resources/copilot-metrics-viewer/issues/398)); once set, anyone not on the list is restricted to their own row.

```
# Opt-in mode: empty allowlist → gate inactive, all authenticated users see everything
NUXT_USAGE_ADMINS=

# Enable row-level scoping — only these logins/emails see cross-user data
NUXT_USAGE_ADMINS=alice,bob@company.com
```

> [!IMPORTANT]
> **Behaviour changes across recent releases:**
> - **3.11.0** introduced `NUXT_USAGE_ADMINS` as a *closed-by-default* gate (empty = nobody is admin).
> - The current release restores **opt-in** semantics: empty = everyone is admin. GitHub org owners no longer need to be listed to see other users' data unless you deliberately turn the gate on.
> - There is **no automatic elevation from GitHub org/enterprise roles** — admin status is determined solely by this env var. If you want row-level scoping, list the small set of humans who should see cross-user data.
> - **PAT-mode** (no OAuth provider configured — `NUXT_PUBLIC_REQUIRE_AUTH`, `NUXT_PUBLIC_USING_GITHUB_AUTH`, `NUXT_PUBLIC_IS_PUBLIC_APP`, `NUXT_PUBLIC_AUTH_PROVIDERS` all unset) always bypasses this gate, because there is no per-user identity to gate on. Lock PAT-mode deployments down at the network layer.

> [!NOTE]
> When `NUXT_GITHUB_BILLING_TOKEN` is unset, the Billing tab is shown to all users (admin or not) but renders a configuration-help placeholder instead of fetching data; the `NUXT_USAGE_ADMINS` gate only applies once the token is configured.

The Billing tab exposes aggregate breakdowns (model / SKU / cost center) and an admin per-user breakdown. Per-user attribution depends on GitHub tagging each item with a `user`; some enterprise plans return only enterprise-level aggregates, in which case the per-user table is hidden behind an explanatory alert. The User Metrics `ai_credits_used` column and the My Usage spend card are independent of this.

##### What non-admins see (only when `NUXT_USAGE_ADMINS` is populated)

Row-level scoping only applies when the allowlist is set. With an empty allowlist every column below reads as "✅ all" for every caller.

| Surface | Non-admin | Admin |
|---|---|---|
| Org / Enterprise aggregate metrics | ✅ all | ✅ all |
| My Usage tab (own data) | ✅ own | ✅ own |
| User Metrics tab | 🔒 own row only + banner | ✅ all rows |
| Seats Analysis tab | 🔒 own seat only | ✅ all seats |
| Teams tab — org scope | 🔒 only teams the caller is a member of | ✅ all teams |
| Teams tab — enterprise scope with `?githubTeam=` | ❌ 403 (GitHub has no enterprise-wide team-membership API) | ✅ all teams |
| Billing tab (token configured) | ❌ hidden | ✅ visible |
| Billing tab (token unset) | ⚙️ configuration-help placeholder | ⚙️ configuration-help placeholder |

The filter is enforced **server-side** — non-admin requests never receive other users' data over the wire. On the Teams tab, KPI tiles automatically switch to aggregate signals (rather than derived-from-user-rows) when the caller is row-restricted, so team totals still render correctly.

##### Auth-mode matrix for Billing & My Usage tabs

Metrics endpoints (User Metrics, My Usage, Seats) accept any token type. Billing endpoints accept ONLY a classic PAT (which is why they have their own dedicated env var).

| Feature | Mock | GitHub App | Fine-grained PAT (`NUXT_GITHUB_TOKEN`) | Classic PAT (`NUXT_GITHUB_BILLING_TOKEN`) |
|---|---|---|---|---|
| My Usage tab metrics | ✅ fixtures | ✅ | ✅ | ✅ |
| User Metrics `ai_credits_used` column | ✅ fixtures | ✅ | ✅ | ✅ |
| My Usage "Your AI credit spend" card | ✅ fixtures | — | — | ✅ with `manage_billing:enterprise` (enterprise-owned orgs) or `manage_billing:copilot` (standalone orgs) |
| Billing tab (aggregate + per-user) | ✅ fixtures | — | — | ✅ with `manage_billing:enterprise` (enterprise-owned orgs) or `manage_billing:copilot` (standalone orgs) |

Even when on the admin allowlist, an admin only sees billing data if `NUXT_GITHUB_BILLING_TOKEN` is set AND the classic PAT has the right scope for the org's billing setup — `manage_billing:enterprise` (SSO-authorized for the target enterprise) for enterprise-owned orgs, or `manage_billing:copilot` for standalone orgs. If GitHub returns 403 or 404, the tab surfaces the message inline so it's clear which side needs adjustment (see `NUXT_BILLING_ENTERPRISE` above for the standalone-vs-enterprise-owned decision).

#### OAuth provider variables

| Variable | Provider | Description |
|---|---|---|
| `NUXT_OAUTH_GITHUB_CLIENT_ID` | GitHub | App client ID |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | GitHub | App client secret |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` | Google | OAuth client ID |
| `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | Google | OAuth client secret |
| `NUXT_OAUTH_MICROSOFT_CLIENT_ID` | Microsoft | App client ID |
| `NUXT_OAUTH_MICROSOFT_CLIENT_SECRET` | Microsoft | App client secret |
| `NUXT_OAUTH_MICROSOFT_TENANT` | Microsoft | Azure AD tenant ID (restricts to org) |
| `NUXT_OAUTH_AUTH0_CLIENT_ID` | Auth0 | App client ID |
| `NUXT_OAUTH_AUTH0_CLIENT_SECRET` | Auth0 | App client secret |
| `NUXT_OAUTH_AUTH0_DOMAIN` | Auth0 | Tenant domain, e.g. `company.auth0.com` |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_ID` | Keycloak | Client ID |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` | Keycloak | Client secret |
| `NUXT_OAUTH_KEYCLOAK_SERVER_URL` | Keycloak | Server URL |
| `NUXT_OAUTH_KEYCLOAK_REALM` | Keycloak | Realm name |

#### NUXT_PUBLIC_HIDDEN_TABS

Comma-separated list of dashboard tab names to hide. Applies at startup without requiring a rebuild — useful for pre-built Docker deployments. The filter is case-insensitive and trims surrounding whitespace.

Available tab names: `languages`, `editors`, `copilot chat`, `agent activity`, `pull requests`, `github.com`, `seat analysis`, `user metrics`, `api response`

````
# Hide the "Agent Activity" and "API Response" tabs
NUXT_PUBLIC_HIDDEN_TABS=agent activity,api response
````

#### NUXT_PUBLIC_ENABLE_HISTORICAL_MODE

Default is `false`. When set to `true`, the application uses a PostgreSQL database (configured via `DATABASE_URL`) to store and query historical Copilot metrics.

> [!IMPORTANT]
> The **Teams** tab is automatically hidden when `NUXT_PUBLIC_ENABLE_HISTORICAL_MODE` is not `true`. Team-level metrics are derived from per-user daily records in the database (`user_day_metrics` table). Without the database, the teams comparison tab would display identical org-wide data for every team.

````
NUXT_PUBLIC_ENABLE_HISTORICAL_MODE=false
````

#### NUXT_PUBLIC_ANNOUNCEMENT_MESSAGE

Optional site-wide announcement banner. When set to a non-empty string, an info banner with this text is shown at the top of the dashboard. Users can dismiss it for the current tab session; a new value re-shows the banner. Leave unset to hide the banner entirely.

````
NUXT_PUBLIC_ANNOUNCEMENT_MESSAGE=Scheduled maintenance on Sat 08:00 UTC — the sync container will be paused for ~30 minutes.
````

#### HTTP_PROXY

Solution supports HTTP Proxy settings when running in corporate environment. Simply set `HTTP_PROXY` environment variable.

For custom CA use environment variable `CUSTOM_CA_PATH` to load the certificate into proxy agent options.

#### NITRO_PORT

Default is `80` in the [Dockerfile](Dockerfile). It defines the port number that Nitro (Nuxt’s server engine) will listen on.

For example, it should be set to a number between 1024 and 49151 if the application is run as a non-root user.

## Install Dependencies

```bash
npm install
```

### Compiles and Runs the Application

```bash
npm run dev
```

### Docker Build

```bash
docker build -t copilot-metrics-viewer .
```

### Docker Run

```bash
docker run -p 8080:80 --env-file ./.env copilot-metrics-viewer
```

The application will be accessible at http://localhost:8080

## Health Check Endpoints

For Kubernetes deployments and health monitoring, the application provides dedicated health check endpoints that don't require authentication and don't make external API calls:

- **`/api/health`** - General health check endpoint
- **`/api/ready`** - Readiness probe endpoint 
- **`/api/live`** - Liveness probe endpoint

All endpoints return JSON responses with status information and respond in ~200ms, making them ideal for Kubernetes health checks instead of using the root `/` endpoint which triggers GitHub API calls.

### Example Kubernetes Configuration

```yaml
livenessProbe:
  httpGet:
    path: /api/live
    port: 80
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/ready
    port: 80
  initialDelaySeconds: 5
  periodSeconds: 5
```

## License

This project is licensed under the terms of the MIT open source license. Please refer to [MIT](./LICENSE.txt) for the full terms.

## Maintainers

[@martedesco](https://github.com/martedesco) & [@karpikpl](https://github.com/karpikpl)

## Support

This project is independently developed and maintained, and is not an official GitHub product. It thrives through the dedicated efforts of ([@martedesco](https://github.com/martedesco)), ([@karpikpl](https://github.com/karpikpl)) and our wonderful contributors. A heartfelt thanks to all our contributors! ✨

I aim to provide support through [GitHub Issues](https://github.com/github-copilot-resources/copilot-metrics-viewer/issues). While I strive to stay responsive, I can't guarantee immediate responses. For critical issues, please include "CRITICAL" in the title for quicker attention. 🙏🏼

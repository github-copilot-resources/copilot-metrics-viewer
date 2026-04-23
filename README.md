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

### Per-User Metrics
View individual user-level Copilot usage metrics including code completions, chat interactions, and code review activity. Summary tiles show total users, active users, and average acceptance rate.

In **Historical mode** (with PostgreSQL), the User Metrics tab also displays per-user time-series history charts, allowing you to track individual adoption trends over time.

<p align="center">
  <img width="800" alt="Per-User Metrics" src="./images/user-metrics.png">
</p>
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

Specifies the GitHub Personal Access Token utilized for API requests. Generate this token with the following permissions: _Read access to members_, _organization copilot metrics_, and _organization copilot seat management_.

> [!IMPORTANT]
> **v3.0 Migration:** The new Copilot Usage Metrics API requires **Read access to members, organization copilot metrics, and organization copilot seat management** permissions. Without this, the new API endpoints will return 400/403 errors. See [GitHub App Registration](DEPLOYMENT.md#github-app-registration) for setup details.

Token is not used in the frontend.

````
NUXT_GITHUB_TOKEN=
````

#### NUXT_GITHUB_APP_ID / NUXT_GITHUB_APP_PRIVATE_KEY / NUXT_GITHUB_APP_INSTALLATION_ID

**Alternative to PAT** — use a GitHub App installation token for backend data access. When all three are set, they take priority over `NUXT_GITHUB_TOKEN`. This is the recommended credential when users authenticate via Google, Microsoft, Auth0, or Keycloak (i.e., non-GitHub identity providers), since the token is machine-issued and not tied to any individual user account.

See [GitHub App Installation Token](DEPLOYMENT.md#github-app-installation-token-no-pat-required) in the deployment guide for full setup instructions.

```bash
NUXT_GITHUB_APP_ID=123456
NUXT_GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----
NUXT_GITHUB_APP_INSTALLATION_ID=12345678
```

#### NUXT_SESSION_PASSWORD (Required!)

This variable is required to encrypt user sessions, it needs to be at least 32 characters long.
For more information see [Nuxt Sessions and Authentication](https://nuxt.com/docs/guide/recipes/sessions-and-authentication#cookie-encryption-key).

>[!WARNING]
> This variable is required starting from version 2.0.0.

#### NUXT_PUBLIC_REQUIRE_AUTH

Default is `false`. When set to `true`, users must sign in via an OAuth provider before accessing the dashboard. The active providers are configured by `NUXT_PUBLIC_AUTH_PROVIDERS`.

#### NUXT_PUBLIC_AUTH_PROVIDERS

Comma-separated list of active OAuth providers: `github`, `google`, `microsoft`, `auth0`, `keycloak`.

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

#### NUXT_PUBLIC_USING_GITHUB_AUTH *(deprecated)*

> [!WARNING]
> Deprecated — use `NUXT_PUBLIC_REQUIRE_AUTH=true` + `NUXT_PUBLIC_AUTH_PROVIDERS=github` instead. The old variable is still recognized for backwards compatibility.

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

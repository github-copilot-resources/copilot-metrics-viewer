_NOTE: For information on support and assistance, click [here](https://github.com/github-copilot-resources/copilot-metrics-viewer/tree/main?tab=readme-ov-file#support)._

# GitHub Copilot Metrics Viewer
<p align="center">
  <img width="150" alt="image" src="https://github.com/github-copilot-resources/copilot-metrics-viewer/assets/3329307/8473a694-217e-4aa2-a3c7-2222a321c336">
</p>

This application displays a set of charts with various metrics related to GitHub Copilot for your <i>GitHub Organization</i> or <i>Enterprise Account</i>. These visualizations are designed to provide clear representations of the data, making it easy to understand and analyze the impact and adoption of GitHub Copilot. This app utilizes the [GitHub Copilot Metrics API](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage?apiVersion=2022-11-28).

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

### Teams Comparison
Compare Copilot metrics across multiple teams within your organization to understand adoption patterns and identify high-performing teams.

<p align="center">
  <img width="800" alt="Teams Comparison" src="./images/teams-comparison.png">
</p>

### GitHub.com Integration & Model Analytics
View comprehensive statistics for GitHub.com features including Chat, PR Summaries, and detailed model usage analytics. Each section provides expandable details showing model types, editors, and usage patterns.

<p align="center">
  <img width="800" alt="GitHub.com Tab" src="./images/github-com-tab.png">
</p>

<p align="center">
  <img width="800" alt="Model Usage Details" src="./images/github-com-models-expanded.png">
</p>

### CSV Export Functionality
Export your metrics data in multiple formats for further analysis or reporting. Options include summary reports, full detailed exports, and direct clipboard copying.

<p align="center">
  <img width="800" alt="CSV Export Options" src="./images/csv-export-functionality.png">
</p>

## Charts

## Key Metrics
>[!NOTE]
> Metrics details are described in detail in [GitHub API response schema](https://docs.github.com/en/rest/copilot/copilot-metrics?apiVersion=2022-11-28#get-copilot-metrics-for-an-organization)

Here are the key metrics visualized in these charts:
<p align="center">
  <img width="800" alt="Key Metrics Overview" src="./images/main-metrics-dashboard.png">
</p>

1. **Acceptance Rate:** This metric represents the ratio of accepted lines and suggestions to the total suggested by GitHub Copilot. This rate is an indicator of the relevance and usefulness of Copilot's suggestions. However, as with any metric, it should be used with caution as developers use Copilot in many different ways (research, confirm, verify, etc., not always "inject").
<p align="center">
  <img width="800" alt="image" src="./images/Acceptance_rate_bycount.png">
</p>

2. **Total Suggestions:** This chart illustrates the total number of code suggestions made by GitHub Copilot. It offers a view of the tool's activity and its engagement with users over time.

3. **Total Acceptances:** This visualization focuses on the total number of suggestions accepted by users.
<p align="center">
  <img width="800" alt="image" src="./images/Total_suggestions_count.png">
</p>

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
- `NUXT_PUBLIC_GITHUB_TEAM`

can be overridden by route parameters, e.g.
- `http://localhost:3000/enterprises/octo-demo-ent`
- `http://localhost:3000/orgs/octo-demo-org`
- `http://localhost:3000/orgs/octo-demo-org/teams/the-a-team`
- `http://localhost:3000/enterprises/octo-demo-ent/teams/the-a-team`
- `http://localhost:3000/orgs/mocked-org?mock=true`

#### NUXT_PUBLIC_SCOPE (Required!)

The `NUXT_PUBLIC_SCOPE` environment variable in the `.env` file determines the default scope of the API calls made by the application. It can be set to 'enterprise', 'organization', 'team-organization' or 'team-enterprise'.

- If set to 'enterprise', the application will target API calls to the GitHub Enterprise account defined in the `NUXT_PUBLIC_GITHUB_ENT` variable.
- If set to 'organization', the application will target API calls to the GitHub Organization account defined in the `NUXT_PUBLIC_GITHUB_ORG` variable.
- If set to 'team', the application will target API calls to GitHub Team defined in the `NUXT_PUBLIC_GITHUB_TEAM` variable under `NUXT_PUBLIC_GITHUB_ORG` GitHub Organization.

For example, if you want to target the API calls to an organization, you would set `NUXT_PUBLIC_SCOPE=organization` in the `.env` file.

>[!INFO]
> Environment variables with `NUXT_PUBLIC` scope are available in the browser (are public).
> See [Nuxt Runtime Config](https://nuxt.com/docs/guide/going-further/runtime-config) for details.

````
NUXT_PUBLIC_SCOPE=organization

NUXT_PUBLIC_GITHUB_ORG=<YOUR-ORGANIZATION>

NUXT_PUBLIC_GITHUB_ENT=
````

#### NUXT_PUBLIC_GITHUB_TEAM

The `NUXT_PUBLIC_GITHUB_TEAM` environment variable filters metrics for a specific GitHub team within an Enterprise or Organization account.
‼️ Important ‼️ When this variable is set, all displayed metrics will pertain exclusively to the specified team. To view metrics for the entire Organization or Enterprise, remove this environment variable.

>[!WARNING]
> GitHub provides Team metrics [for a given day if the team had five or more members with active Copilot licenses, as evaluated at the end of that day.](https://docs.github.com/en/rest/copilot/copilot-usage?apiVersion=2022-11-28#get-a-summary-of-copilot-usage-for-a-team).

````
NUXT_PUBLIC_GITHUB_TEAM=
````

#### NUXT_PUBLIC_IS_DATA_MOCKED

Variable is false by default. To view mocked data switch it to true or use query parameter `?mock=true`.

````
NUXT_PUBLIC_IS_DATA_MOCKED=false
````

#### NUXT_GITHUB_TOKEN

Specifies the GitHub Personal Access Token utilized for API requests. Generate this token with the following scopes: _copilot_, _manage_billing:copilot_, _manage_billing:enterprise_, _read:enterprise_, _read:org_.

Token is not used in the frontend.

````
NUXT_GITHUB_TOKEN=
````

#### NUXT_SESSION_PASSWORD (Required!)

This variable is required to encrypt user sessions, it needs to be at least 32 characters long.
For more information see [Nuxt Sessions and Authentication](https://nuxt.com/docs/guide/recipes/sessions-and-authentication#cookie-encryption-key).

>[!WARNING]
> This variable is required starting from version 2.0.0.

#### NUXT_PUBLIC_USING_GITHUB_AUTH

Default is `false`. When set to `true`, GitHub OAuth App Authentication will be performed to verify users' access to the dashboard. For this, a GitHub App must be registered and installed in the enterprise/org. See [GitHub App Registration](DEPLOYMENT.md#github-app-registration) for the steps to follow.

Variables required for GitHub Auth are:
1. `NUXT_OAUTH_GITHUB_CLIENT_ID` - client ID of the GitHub App.
2. `NUXT_OAUTH_GITHUB_CLIENT_SECRET` - client secret of the GitHub App.
3. [Optional] `NUXT_OAUTH_GITHUB_CLIENT_SCOPE` for scope requests when using OAuth App instead of GitHub App. See [GitHub docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps) for details.

>[!WARNING]
> Only users with permissions (scopes listed in [NUXT_GITHUB_TOKEN](#NUXT_GITHUB_TOKEN)) can view copilot metrics, GitHub uses the authenticated users permissions to make API calls for data.

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

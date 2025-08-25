_NOTE: For information on support and assistance, click [here](https://github.com/github-copilot-resources/copilot-metrics-viewer/tree/main?tab=readme-ov-file#support)._

# GitHub Copilot Metrics Viewer
<p align="center">
  <img width="150" alt="image" src="https://github.com/github-copilot-resources/copilot-metrics-viewer/assets/3329307/8473a694-217e-4aa2-a3c7-2222a321c336">
</p>

This application displays a set of charts with various metrics related to GitHub Copilot for your <i>GitHub Organization</i> or <i>Enterprise Account</i>. These visualizations are designed to provide clear representations of the data, making it easy to understand and analyze the impact and adoption of GitHub Copilot. This app utilizes the [GitHub Copilot Metrics API](https://docs.github.com/en/enterprise-cloud@latest/rest/copilot/copilot-usage?apiVersion=2022-11-28).

## Video

https://github.com/github-copilot-resources/copilot-metrics-viewer/assets/3329307/bc7e2a16-cc73-43c4-887a-b50809c08533

## Charts

## Key Metrics
>[!NOTE]
> Metrics details are described in detail in [GitHub API response schema](https://docs.github.com/en/rest/copilot/copilot-metrics?apiVersion=2022-11-28#get-copilot-metrics-for-an-organization)

Here are the key metrics visualized in these charts:
<p align="center">
  <img width="800" alt="image" src="./images/KeyMetrics.png">
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
  <img width="800" alt="image" src="./images/Language_breakdown.png">
</p>

The language breakdown analysis tab also displays a table showing the Accepted Prompts, Accepted Lines of Code, and Acceptance Rate (%) for each language over the past 28 days. The entries are sorted by the number of _accepted lines of code descending_.
<p align="center">
  <img width="800" alt="image" src="./images/Language_breakdown_list.png">
</p>

## Copilot Chat Metrics

<p align="center">
  <img width="800" alt="image" src="https://github.com/github-copilot-resources/copilot-metrics-viewer/assets/3329307/79867d5f-8933-4509-a58a-8c6deeb47536">
</p>

1. **Cumulative Number of Turns:** This metric represents the total number of turns (interactions) with the Copilot over the past 28 days. A 'turn' includes both user inputs and Copilot's responses.

2. **Cumulative Number of Acceptances:** This metric shows the total number of lines of code suggested by Copilot that have been accepted by users over the past 28 days.

3. **Total Turns | Total Acceptances Count:** This is a chart that displays the total number of turns and acceptances.

4. **Total Active Copilot Chat Users:** A bar chart that illustrates the total number of users who have actively interacted with Copilot over the past 28 days.

## Seat Analysis
<p align="center">
  <img width="800" alt="image" src="https://github.com/github-copilot-resources/copilot-metrics-viewer/assets/54096296/51747194-df30-4bfb-8849-54a0510fffcb">
</p>

1. **Total Assigned:** This metric represents the total number of Copilot seats assigned within the current organization/enterprise.

2. **Assigned But Never Used:** This metric shows seats that were assigned but never used within the current organization/enterprise. The assigned timestamp is also displayed in the chart.

3. **No Activity in the Last 7 Days:** Never used seats or seats used, but with no activity in the past 7 days.

4. **No Activity in the Last 7 Days (including never used seats):** A table to display seats that have had no activity in the past 7 days, ordered by the date of last activity. Seats that were used earlier are displayed at the top.

## Local Development Setup

### Prerequisites

Before running the application locally, ensure you have the following installed:

```bash
# Node.js 18 or higher
node --version  # Should be 18.x or higher
npm --version   # Should be 9.x or higher

# Git (for cloning the repository)
git --version

# Optional: Docker (for containerized development)
docker --version
```

### Quick Start

1. **Clone the Repository**
   ```bash
   git clone https://github.com/github-copilot-resources/copilot-metrics-viewer.git
   cd copilot-metrics-viewer
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   
   Create a `.env` file in the project root:
   ```bash
   # Copy the example environment file
   cp .env.example .env
   
   # Or create manually with the following content:
   cat > .env << 'EOF'
   # GitHub Authentication (Required)
   NUXT_GITHUB_TOKEN=your-github-pat-here
   NUXT_SESSION_PASSWORD=your-secure-32-char-session-password-here
   
   # GitHub Organization Settings
   NUXT_PUBLIC_SCOPE=organization
   NUXT_PUBLIC_GITHUB_ORG=your-github-org
   NUXT_PUBLIC_GITHUB_ENT=your-github-enterprise
   NUXT_PUBLIC_GITHUB_TEAM=
   
   # Application Settings
   NUXT_PUBLIC_USING_GITHUB_AUTH=false
   NUXT_PUBLIC_IS_DATA_MOCKED=false
   
   # Optional: Basic Authentication
   # NUXT_BASIC_AUTH_USERNAME=admin
   # NUXT_BASIC_AUTH_PASSWORD=devpassword123
   EOF
   ```

4. **Generate GitHub Personal Access Token**
   
   Create a GitHub PAT with the following scopes:
   - `copilot`
   - `manage_billing:copilot`
   - `manage_billing:enterprise`
   - `read:enterprise`
   - `read:org`
   
   Add the token to your `.env` file as `NUXT_GITHUB_TOKEN=your-token-here`

5. **Run the Development Server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:3000`

### Development Features

- **Hot Reload**: Changes automatically refresh the browser
- **Vue DevTools**: Browser extension for debugging Vue components
- **API Debugging**: Console logs for GitHub API calls
- **Mock Data Mode**: Test without real GitHub API calls

### Environment Variables Reference

#### Required Variables

- **`NUXT_GITHUB_TOKEN`**: GitHub Personal Access Token for API authentication
- **`NUXT_SESSION_PASSWORD`**: 32+ character string for session encryption

#### GitHub Configuration

- **`NUXT_PUBLIC_SCOPE`**: API scope (`enterprise`, `organization`, or `team`)
- **`NUXT_PUBLIC_GITHUB_ORG`**: GitHub organization name
- **`NUXT_PUBLIC_GITHUB_ENT`**: GitHub enterprise name (if using enterprise scope)
- **`NUXT_PUBLIC_GITHUB_TEAM`**: GitHub team name (if using team scope)

#### Optional Features

- **`NUXT_PUBLIC_IS_DATA_MOCKED`**: Set to `true` to use mock data instead of API calls
- **`NUXT_PUBLIC_USING_GITHUB_AUTH`**: Enable GitHub OAuth authentication
- **`NUXT_BASIC_AUTH_USERNAME`** / **`NUXT_BASIC_AUTH_PASSWORD`**: Enable basic authentication

### URL Parameters and Routes

You can override environment variables using URL parameters:

```bash
# Organization view
http://localhost:3000/orgs/your-org-name

# Enterprise view  
http://localhost:3000/enterprises/your-enterprise-name

# Team view
http://localhost:3000/orgs/your-org-name/teams/your-team-name

# Mock data mode (for testing)
http://localhost:3000/orgs/any-org?mock=true
```

### Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Run tests
npm run test

# Run end-to-end tests
npm run test:e2e

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run typecheck
```

### Docker Development

```bash
# Build Docker image
docker build -t copilot-metrics-viewer .

# Run with environment file
docker run -p 8080:80 --env-file ./.env copilot-metrics-viewer

# Access at http://localhost:8080
```

### Testing with Mock Data

For development and testing without consuming GitHub API quota:

```bash
# Enable mock data mode
export NUXT_PUBLIC_IS_DATA_MOCKED=true

# Start development server
npm run dev

# Or use URL parameter
open http://localhost:3000?mock=true
```

### Troubleshooting

**Authentication Issues:**
- Verify your GitHub PAT has the correct scopes
- Ensure the PAT is authorized for SAML SSO (if your org requires it)
- Check that your organization/enterprise names are correct

**API Rate Limits:**
- Use mock data mode during development
- Consider using GitHub OAuth instead of PAT for production

**Session Errors:**
- Ensure `NUXT_SESSION_PASSWORD` is at least 32 characters long
- Use a cryptographically secure random string

**Port Conflicts:**
- The default port is 3000, change with: `npm run dev -- --port 3001`

### Quick Development Reference

```bash
# Clone and setup
git clone <repository-url>
cd copilot-metrics-viewer
npm install
cp .env.example .env  # Then edit .env with your values

# Development
npm run dev           # Start dev server at http://localhost:3000
npm run dev -- --port 3001  # Use different port
npm run build         # Build for production
npm run preview       # Preview production build

# Testing
npm run test          # Run unit tests
npm run test:e2e      # Run end-to-end tests
npm run lint          # Check code style
npm run typecheck     # TypeScript checking

# Docker
docker build -t copilot-metrics-viewer .
docker run -p 8080:80 --env-file ./.env copilot-metrics-viewer

# Mock data (no API calls)
NUXT_PUBLIC_IS_DATA_MOCKED=true npm run dev
# Or visit: http://localhost:3000?mock=true
```

## Advanced Configuration

### NUXT_PUBLIC_GITHUB_TEAM

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

Default is `false`. When set to `true`, GitHub OAuth App Authentication will be performed to verify users' access to the dashboard.

Variables required for GitHub Auth are:
1. `NUXT_OAUTH_GITHUB_CLIENT_ID` - client ID of the GitHub App registered and installed in the enterprise/org with permissions listed in [NUXT_GITHUB_TOKEN](#NUXT_GITHUB_TOKEN).
2. `NUXT_OAUTH_GITHUB_CLIENT_SECRET` - client secret of the GitHub App.
3. [Optional] `NUXT_OAUTH_GITHUB_CLIENT_SCOPE` for scope requests when using OAuth App instead of GitHub App. See [Github docs](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps) for details.

>[!WARNING]
> Only users with permissions (scopes listed in [NUXT_GITHUB_TOKEN](#NUXT_GITHUB_TOKEN)) can view copilot metrics, GitHub uses the authenticated users permissions to make API calls for data.

#### Support for HTTP Proxy HTTP_PROXY

Solution supports HTTP Proxy settings when running in corporate environment. Simple set `HTTP_PROXY` environment variable.

For custom CA use environment variable `CUSTOM_CA_PATH` to load the certificate into proxy agent options.

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

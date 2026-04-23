# Deployment of Copilot Metrics Viewer

There are a few ways to deploy the Copilot Metrics Viewer, depending on the type of metrics (Organization/Enterprise) and the level of control required.

The app runs in a Docker container, so it can be deployed anywhere containers are hosted (AWS, GCP, Azure, Kubernetes, etc.).

## Architecture

The application supports two operating modes:

### Direct API Mode (no database)
The simplest setup — the web app fetches metrics directly from GitHub's Copilot Usage Metrics API on each page load, returning the latest 28-day rolling window.

| Component | Description | Required |
|-----------|-------------|----------|
| **Web App** | Nuxt 3 dashboard (port 3000/80) | Yes |

### Historical Mode (with database)
Adds a PostgreSQL database and sync service for persistent storage. This enables metrics beyond the 28-day API window, per-user time-series history, and full historical team views.

| Component | Description | Required |
|-----------|-------------|----------|
| **Web App** | Nuxt 3 dashboard (port 3000/80) | Yes |
| **PostgreSQL** | Database for historical metrics storage | Yes |
| **Sync Service** | Scheduled job that downloads metrics from GitHub API to PostgreSQL | Yes |

The sync service runs daily (2 AM UTC by default) and downloads the latest Copilot usage metrics from GitHub's API. The web app reads from the database for fast, reliable dashboard rendering.

#### How Team Metrics Work

GitHub's Copilot Usage Metrics API does not provide team-level endpoints. Instead, this application **derives team metrics** by:
1. Downloading per-user daily metrics from the organization/enterprise endpoint
2. Resolving team membership via the GitHub Teams API
3. Filtering and aggregating per-user data in-memory for each team

This approach works in **Historical mode** only:
- **Direct API mode**: Team-scoped views are not available (no per-user data stored to filter)
- **Historical mode**: Team data covers the full stored history, enabling long-term team trend analysis

## Deployment options

Review available [Nuxt Deployment Options](https://nuxt.com/deploy).

>[!WARNING]
> Copilot Metrics Viewer requires a backend, hence it cannot be deployed as a purely static web app.

## Authentication

The Metrics Viewer supports two modes:

- **PAT mode (default)**: A GitHub Personal Access Token is stored in the backend. Users access the app without signing in. The app renders metrics fetched using the PAT. No user authentication happens.
- **OAuth mode**: Users must sign in through an identity provider before accessing the dashboard. The app supports GitHub, Google, Microsoft Entra ID, Auth0, and Keycloak — configured entirely by environment variables.

See the [Authentication](#authentication-1) reference section for setup details.

## Platform security for Azure

By default Azure Deployments deploy a web app available on the public Internet without authentication (unless OAuth is configured).

Application can be easily secured in Azure using built-in features like Authentication settings on ACA/AppService (EasyAuth on Azure). Azure Container Apps and App Services allow for adding IP restrictions on ingress. Both can also be deployed using private networking architectures.

Options below provide most basic and cost effective ways of hosting copilot-metrics-viewer.

## Scenario 1: One-click Azure Deployment

The simplest way to deploy is to use the "one-click" option that creates resources in Azure. The deployment includes:

* Azure Container App with a consumption environment
* Azure Container App Job (sync service, daily schedule)
* Azure Database for PostgreSQL Flexible Server (Burstable B1ms)
* Azure Log Analytics Workspace

![Azure ARM Deployment](./azure-deploy/arm-deployment.png)

Application will use a pre-built docker image hosted in GitHub registry: `ghcr.io/github-copilot-resources/copilot-metrics-viewer`.

**Prerequisites:** Contributor permission to a resource group in Azure and a subscription with the `Microsoft.App` and `Microsoft.DBforPostgreSQL` resource providers enabled.

> [!IMPORTANT]
> **Estimated cost** for running this in Azure is about $15/month (Container Apps ~$1 + PostgreSQL Burstable B1ms ~$12 + Log Analytics ~$2).

1. **Option 1 - Using a Personal Access Token in the Backend**:

    [![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fgithub-copilot-resources%2Fcopilot-metrics-viewer%2Fmain%2Fazure-deploy%2Fwith-token%2Fazuredeploy.json/uiFormDefinitionUri/https%3A%2F%2Fraw.githubusercontent.com%2Fgithub-copilot-resources%2Fcopilot-metrics-viewer%2Fmain%2Fazure-deploy%2Fwith-token%2Fportal.json)

2. **Option 2 - Using GitHub App Registration and GitHub Authentication**:

    When using this method, [register your app in Github first](#github-app-registration).

    [![Deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fgithub-copilot-resources%2Fcopilot-metrics-viewer%2Fmain%2Fazure-deploy%2Fwith-app-registration%2Fazuredeploy.json/uiFormDefinitionUri/https%3A%2F%2Fraw.githubusercontent.com%2Fgithub-copilot-resources%2Fcopilot-metrics-viewer%2Fmain%2Fazure-deploy%2Fwith-app-registration%2Fportal.json)

>[!IMPORTANT]
>**Important**: After deploying Option 2, the redirect URI needs to be updated with the URL of the deployed container app.
>
>Go to: `https://github.com/organizations/<your-org>/settings/apps/<your-app>` or in the UI to the settings of the registered application and add the following redirect URL: `https://<your-container-app-name-and-region>.azurecontainerapps.io/auth/github`

### Deployment with private networking

> [!CAUTION]
> When deploying to a private network, specify a subnet (at least /23) for the Azure Container Apps Environment.
App deployment does not create any DNS entries for the application, in order to create a private DNS Zone linked to provided Virtual Network, follow up the deployment with DNS deployment targeting same resource group:
>
>[![DNS Zone deploy to Azure](https://aka.ms/deploytoazurebutton)](https://portal.azure.com/#create/Microsoft.Template/uri/https%3A%2F%2Fraw.githubusercontent.com%2Fgithub-copilot-resources%2Fcopilot-metrics-viewer%2Fmain%2Fazure-deploy%2Fdns%2Fazuredeploy.json)

## Scenario 2: Azure Deployment with azd

If more control over the deployed container image is needed, an infrastructure-as-code option has been provided using Azure Bicep. The application can be deployed using the [Azure Developer CLI](https://aka.ms/azd) (azd).

In this scenario, the container is built from the source code locally, which provides additional opportunities to modify, scan, etc.

**Prerequisites:** 
- Contributor permission to a subscription in Azure with the `Microsoft.App` and `Microsoft.DBforPostgreSQL` resource providers enabled.
- Permissions for creating role assignments.
- Azure CLI (az), Azure Developer CLI  (azd) and Docker installed locally.

> [!IMPORTANT]
> **Estimated cost** for running this in Azure is about $25/month (Container Apps ~$1 + Container Registry ~$5 + PostgreSQL ~$12 + monitoring ~$5).

The deployment creates:

* Azure Resource Group
* Azure Container App with a consumption environment
* Azure Container App Job (sync service)
* Azure Container Registry
* Azure Database for PostgreSQL Flexible Server
* Azure Log Analytics Workspace
* Azure Application Insights
* Azure Key Vault

![AZD Deployment](./azure-deploy/azd-deployment.png)

Run `azd up` and follow the prompts. You will be asked for:
- GitHub PAT token (or OAuth client credentials)
- GitHub scope (organization/enterprise)
- Organization/enterprise name
- PostgreSQL admin password

## Scenario 3: Docker Compose

The recommended way to run the application locally or in any Docker-capable environment. Docker Compose manages the web app, PostgreSQL database, and sync service together.

### Quick Start with Mock Data

No GitHub token needed — great for trying out the dashboard:

```bash
docker compose up web
# Open http://localhost:3000/orgs/your-org?mock=true
```

### Running with Real GitHub Data (Direct API — no database)

The simplest setup — metrics come directly from the GitHub API (28-day rolling window):

```bash
export NUXT_GITHUB_TOKEN=github_pat_...    # Fine-grained PAT with "Copilot metrics" permission
export NUXT_PUBLIC_GITHUB_ORG=your-org
export NUXT_PUBLIC_IS_DATA_MOCKED=false

docker compose up web
# Open http://localhost:3000/orgs/your-org
```

> [!NOTE]
> **Team-scoped views** (e.g., `/orgs/your-org/teams/your-team`) require **Historical mode** with PostgreSQL. Without the database, team metrics cannot be computed because team data is derived by filtering per-user records stored in the database. The Teams Comparison tab is available to browse teams, but individual team drill-down requires Historical mode.

### Running with Historical Mode (database + sync)

Adds PostgreSQL for persistent storage — enables metrics beyond 28 days, per-user time-series history, and full historical team views:

```bash
export NUXT_GITHUB_TOKEN=github_pat_...    # Fine-grained PAT with "Copilot metrics" permission
export NUXT_PUBLIC_GITHUB_ORG=your-org
export NUXT_PUBLIC_IS_DATA_MOCKED=false
export ENABLE_HISTORICAL_MODE=true

# Start web app + database
docker compose up web db

# In a separate terminal, run initial sync to populate the database
docker compose run --rm sync

# Open http://localhost:3000/orgs/your-org
```

The sync service downloads all available historical data on first run. Subsequent runs (or the daily schedule) only sync the latest day.

### Enterprise Scope

```bash
export NUXT_GITHUB_TOKEN=github_pat_...
export NUXT_PUBLIC_SCOPE=enterprise
export NUXT_PUBLIC_GITHUB_ENT=your-enterprise
export NUXT_PUBLIC_IS_DATA_MOCKED=false
export ENABLE_HISTORICAL_MODE=true

docker compose up web db
docker compose run --rm sync
```

### Services Overview

| Service              | Purpose                                          | Profile  |
|----------------------|--------------------------------------------------|----------|
| `db`                 | PostgreSQL 15 for metrics storage                | default  |
| `web`                | Main Nuxt 3 dashboard (port 3000)                | default  |
| `sync`               | Standalone sync service (API → PostgreSQL)        | default  |
| `playwright`         | E2E tests with mock data (3 browsers)            | test     |
| `sync-seed`          | Seeds DB with mock data for storage pipeline     | test     |
| `playwright-storage` | E2E tests reading from DB, no token needed       | test     |

### Running E2E Tests

**Mock data tests** (all tests across 3 browsers):

```bash
docker compose run --rm playwright
# Results saved to ./test-results/
```

**Storage pipeline tests** (full sync → DB → dashboard):

```bash
# Phase 1: Seed the database with mock data
docker compose run --rm sync-seed

# Phase 2: Verify dashboard reads from DB (no GitHub token)
docker compose run --rm playwright-storage
```

### Stopping and Cleaning Up

```bash
docker compose down              # Stop all services
docker compose down -v           # Stop and remove volumes (delete all data)
```

## Scenario 4: Kubernetes

Kubernetes manifests are provided in the `k8s/` directory:

- `k8s/deployment.yaml` — Web app Deployment + Service with health probes
- `k8s/cronjob.yaml` — Sync service CronJob (daily at 2 AM)

### Prerequisites

- A PostgreSQL database (managed service recommended: AWS RDS, Azure Database for PostgreSQL, Google Cloud SQL)
- Container images from GHCR:
  - `ghcr.io/github-copilot-resources/copilot-metrics-viewer:latest`
  - `ghcr.io/github-copilot-resources/copilot-metrics-viewer-sync:latest`

### Setup

1. Create the secrets:

```bash
kubectl create secret generic copilot-metrics-secrets \
  --from-literal=github-token="ghp_your_token_here" \
  --from-literal=session-password="at_least_32_characters_long_random_string" \
  --from-literal=database-url="postgresql://user:pass@your-db-host:5432/copilot_metrics"
```

2. Edit the manifests to set your organization/enterprise name.

3. Apply:

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/cronjob.yaml
```

### Health Check Configuration

The web app provides dedicated health check endpoints:

- **`/api/live`** — Liveness probe (application is alive and responsive)
- **`/api/ready`** — Readiness probe (application ready to serve traffic)
- **`/api/health`** — General health status

These endpoints respond in ~200ms without making external API calls and do not require authentication.

>[!NOTE]
> Using these dedicated health endpoints instead of the root `/` path avoids triggering GitHub API calls during health checks.

### Admin Sync API

When running in Historical mode, the web app exposes a manual sync endpoint for backfilling or repairing data. If the app is configured with `NUXT_GITHUB_TOKEN`, the Authorization header is optional (the server uses its own token).

> **Note:** The GitHub Copilot Metrics API provides historical data well beyond the 28-day rolling window. The 1-day endpoint supports dates going back many months, so `sync-date`, `sync-range`, and `sync-gaps` can all backfill historical data. The 28-day limit only applies to `sync-last-28` (which uses the bulk download endpoint).

**`POST /api/admin/sync`**

Common parameters (body JSON or query string — `Content-Type: application/json` is optional):

| Parameter | Description |
|-----------|-------------|
| `scope` | `organization` or `enterprise` |
| `githubOrg` | Organization slug (org scope) |
| `githubEnt` | Enterprise slug (enterprise scope) |
| `action` | One of the actions below (default: `sync-date`) |

#### Actions

**`sync-date`** — Download and store metrics for a single day (supports any historical date).

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Content-Type: application/json" \
  -d '{"action":"sync-date","scope":"organization","githubOrg":"your-org","date":"2026-01-15"}'
# → {"action":"sync-date","result":{"success":true,"date":"2026-01-15","metricsCount":1}}
```

**`sync-last-28`** — Download the latest 28-day report and store any new days. Most efficient for keeping the database current (1 API call for 28 days).

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Content-Type: application/json" \
  -d '{"action":"sync-last-28","scope":"organization","githubOrg":"your-org"}'
# → {"action":"sync-last-28","success":true,"totalDays":28,"savedDays":27,"skippedDays":1,"errors":[]}
```

**`sync-range`** — Download and store all days in a date range (one API call per day). Use for initial historical backfill.

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Content-Type: application/json" \
  -d '{"action":"sync-range","scope":"organization","githubOrg":"your-org","since":"2026-01-01","until":"2026-03-31"}'
```

**`sync-gaps`** — Like `sync-range` but skips dates already present in the database. Uses bulk download for recent gaps and the 1-day endpoint for older gaps.

```bash
curl -X POST http://localhost:3000/api/admin/sync \
  -H "Content-Type: application/json" \
  -d '{"action":"sync-gaps","scope":"organization","githubOrg":"your-org","since":"2026-01-01","until":"2026-04-20"}'
# → {"action":"sync-gaps","gapsDetected":82,"gapsFilled":80,"outsideWindow":0,"failureCount":2,"results":[...]}
```

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NUXT_GITHUB_TOKEN` | GitHub PAT with Copilot metrics permission | Yes (PAT mode) |
| `NUXT_PUBLIC_SCOPE` | `organization` or `enterprise` (legacy `team-organization`/`team-enterprise` have been removed; existing values are auto-normalized) | Yes |
| `NUXT_PUBLIC_GITHUB_ORG` | GitHub organization slug | For org scope |
| `NUXT_PUBLIC_GITHUB_ENT` | GitHub enterprise slug | For enterprise scope |
| `NUXT_SESSION_PASSWORD` | Session encryption key (min 32 chars) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Historical mode only |
| `ENABLE_HISTORICAL_MODE` | `true` to read metrics from database | Historical mode only |
| `SYNC_ENABLED` | `true` for sync service, `false` for web app | Historical mode only |
| `SYNC_DAYS_BACK` | Days to sync (default: 1 for daily, 28 for bulk) | Sync only |
| `NUXT_PUBLIC_REQUIRE_AUTH` | `true` to require OAuth sign-in | OAuth mode |
| `NUXT_PUBLIC_AUTH_PROVIDERS` | Comma-separated active providers: `github`, `google`, `microsoft`, `auth0`, `keycloak` | OAuth mode |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` | GitHub App client ID | GitHub OAuth |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | GitHub App client secret | GitHub OAuth |
| `NUXT_OAUTH_GOOGLE_CLIENT_ID` | Google OAuth client ID | Google OAuth |
| `NUXT_OAUTH_GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Google OAuth |
| `NUXT_OAUTH_MICROSOFT_CLIENT_ID` | Microsoft app client ID | Microsoft OAuth |
| `NUXT_OAUTH_MICROSOFT_CLIENT_SECRET` | Microsoft app client secret | Microsoft OAuth |
| `NUXT_OAUTH_MICROSOFT_TENANT` | Azure AD tenant ID (restricts to your org) | Microsoft OAuth |
| `NUXT_OAUTH_AUTH0_CLIENT_ID` | Auth0 app client ID | Auth0 OAuth |
| `NUXT_OAUTH_AUTH0_CLIENT_SECRET` | Auth0 app client secret | Auth0 OAuth |
| `NUXT_OAUTH_AUTH0_DOMAIN` | Auth0 tenant domain, e.g. `company.auth0.com` | Auth0 OAuth |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_ID` | Keycloak client ID | Keycloak OAuth |
| `NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET` | Keycloak client secret | Keycloak OAuth |
| `NUXT_OAUTH_KEYCLOAK_SERVER_URL` | Keycloak server URL | Keycloak OAuth |
| `NUXT_OAUTH_KEYCLOAK_REALM` | Keycloak realm name | Keycloak OAuth |
| `NUXT_AUTHORIZED_USERS` | Comma-separated logins/emails allowed to log in (any provider) | Optional |
| `NUXT_AUTHORIZED_EMAIL_DOMAINS` | Comma-separated email domains allowed, e.g. `company.com` | Optional |
| `NUXT_PUBLIC_USING_GITHUB_AUTH` | *(Deprecated)* Use `NUXT_PUBLIC_REQUIRE_AUTH=true` + `NUXT_PUBLIC_AUTH_PROVIDERS=github` instead | — |

## Authentication

The app supports the following authentication modes, selected entirely by environment variables. No code changes are needed to switch providers.

### PAT Mode (default — no user login)

Set a GitHub Personal Access Token. All visitors see the dashboard without signing in.

```bash
NUXT_GITHUB_TOKEN=ghp_...
```

The PAT must have the following scopes:
- `read:org` — read organization membership
- `copilot` — read Copilot usage
- `manage_billing:copilot` — read seat management (optional)

In PAT mode the toolbar shows a shield icon (🛡) that explains available OAuth options when clicked.

---

### GitHub App Installation Token (no PAT required)

A GitHub App installation token lets the backend fetch Copilot data **without any user-owned PAT**. This is the recommended credential for deployments where users authenticate via Google, Microsoft, Auth0, or Keycloak (i.e. non-GitHub identity providers).

**Why use this instead of a PAT?**

| | PAT | GitHub App installation token |
|---|---|---|
| Tied to a specific user account | ✅ yes | ❌ no — machine credential |
| Revoked when user leaves org | ✅ yes | ❌ no |
| Scoped to exactly the permissions you grant | limited | ✅ yes |
| Works with Google/Microsoft/Auth0/Keycloak auth | ✅ yes (workaround) | ✅ yes (native) |

**Create a GitHub App:**

1. Go to your org → Settings → Developer Settings → GitHub Apps → **New GitHub App**
2. Give it a name (e.g. `copilot-metrics-viewer`)
3. Disable Webhook (uncheck "Active")
4. Under **Repository permissions**: none required
5. Under **Organization permissions**:
   - `Copilot` → Read-only
   - `Members` → Read-only (for seat analysis)
6. Set "Where can this GitHub App be installed?" → **Only on this account**
7. Click **Create GitHub App**, then note the **App ID** on the next page

**Generate a private key:**

1. On the App settings page, scroll to **Private keys** → **Generate a private key**
2. A `.pem` file downloads automatically
3. Flatten the key to a single-line env var:
   ```bash
   # macOS/Linux — prints the key with literal \n between lines
   awk 'NF {printf "%s\\n", $0}' ~/Downloads/my-app.private-key.pem
   ```
4. Copy the output (starts with `-----BEGIN RSA PRIVATE KEY-----\n...`)

**Install the App on your org:**

1. On the App page, click **Install App** → choose your org → **Install**
2. The installation ID is **auto-discovered** at runtime — no manual configuration needed.
   If you have multiple installs, the app matches against `NUXT_PUBLIC_GITHUB_ORG`, or shows an org picker.

**Configure env vars:**

```bash
NUXT_GITHUB_APP_ID=123456
NUXT_GITHUB_APP_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----\nMIIEo...\n-----END RSA PRIVATE KEY-----
```

> [!NOTE]
> When `NUXT_GITHUB_APP_ID` + `NUXT_GITHUB_APP_PRIVATE_KEY` are set, the app auto-discovers the installation for the configured org and uses an installation token for every data request. The `NUXT_GITHUB_TOKEN` PAT is ignored.
>
> If the App is installed on multiple orgs and no `NUXT_PUBLIC_GITHUB_ORG` is set, users are shown an org picker after login.

> [!TIP]
> Installation tokens are cached in memory for up to 55 minutes and automatically refreshed. You don't need to restart the server.

---

### GitHub OAuth

Requires a [GitHub App](https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps) or [OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app).

**Create a GitHub App:**

1. Go to your org → Settings → Developer Settings → GitHub Apps → New GitHub App
2. Set **Callback URL**: `https://<your-app>/auth/github`
3. Uncheck **Active** under Webhooks
4. Set permissions: Organization → Members (Read), Copilot Metrics (Read), Copilot Seat Management (Read)
5. Generate a Client Secret

**Environment variables:**

```bash
NUXT_PUBLIC_REQUIRE_AUTH=true
NUXT_PUBLIC_AUTH_PROVIDERS=github
NUXT_OAUTH_GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxx
NUXT_OAUTH_GITHUB_CLIENT_SECRET=xxxxxxxxxxxx
```

---

### Google OAuth

1. Open [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an **OAuth 2.0 Client ID** (Web application)
3. Add **Authorized redirect URI**: `https://<your-app>/auth/google`

**Environment variables:**

```bash
NUXT_PUBLIC_REQUIRE_AUTH=true
NUXT_PUBLIC_AUTH_PROVIDERS=google
NUXT_OAUTH_GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=xxxxxxxxxxxx

# Optional: restrict to a specific email domain
NUXT_AUTHORIZED_EMAIL_DOMAINS=company.com
```

---

### Microsoft / Entra ID (Azure AD)

1. Open [Azure Portal → App Registrations → New Registration](https://portal.azure.com/#blade/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps)
2. Set **Redirect URI**: `https://<your-app>/auth/microsoft`
3. Under **Certificates & Secrets**, create a new client secret
4. Note the **Application (client) ID**, **Directory (tenant) ID**, and secret value

**Environment variables:**

```bash
NUXT_PUBLIC_REQUIRE_AUTH=true
NUXT_PUBLIC_AUTH_PROVIDERS=microsoft
NUXT_OAUTH_MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
NUXT_OAUTH_MICROSOFT_CLIENT_SECRET=xxxxxxxxxxxx
# Restricts sign-in to your Azure AD tenant (strongly recommended):
NUXT_OAUTH_MICROSOFT_TENANT=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

> [!TIP]
> Setting `NUXT_OAUTH_MICROSOFT_TENANT` to your tenant ID automatically restricts access to users in your organization's Azure Active Directory — no need for `NUXT_AUTHORIZED_EMAIL_DOMAINS` in most cases.

---

### Auth0

Auth0 acts as an identity aggregator. Configure it once and it can front GitHub, Google, Microsoft, LDAP, SAML, and many more identity sources. Useful for organizations that already use Auth0 or need fine-grained access control (MFA, connection restrictions, roles).

1. Log in to the [Auth0 Dashboard](https://manage.auth0.com/)
2. Create a new **Regular Web Application**
3. Under **Settings → Allowed Callback URLs**, add: `https://<your-app>/auth/auth0`
4. Note the **Domain**, **Client ID**, and **Client Secret**
5. Configure allowed connections (GitHub, Google, etc.) under **Authentication → Social**

**Environment variables:**

```bash
NUXT_PUBLIC_REQUIRE_AUTH=true
NUXT_PUBLIC_AUTH_PROVIDERS=auth0
NUXT_OAUTH_AUTH0_CLIENT_ID=xxxxxxxxxxxx
NUXT_OAUTH_AUTH0_CLIENT_SECRET=xxxxxxxxxxxx
NUXT_OAUTH_AUTH0_DOMAIN=your-tenant.auth0.com

# Optional: restrict by email domain (Auth0 often handles this natively via connection/org settings)
NUXT_AUTHORIZED_EMAIL_DOMAINS=company.com
```

> [!TIP]
> Auth0 organizations and connection-level policies can enforce access without requiring `NUXT_AUTHORIZED_*` env vars. Prefer Auth0's native controls for the cleanest setup.

---

### Keycloak

Keycloak is a self-hosted, open-source identity and access management server. Ideal for air-gapped, regulated, or on-premises environments.

1. Create a new **Realm** (or use an existing one)
2. Create a **Client**: set **Client Protocol** to `openid-connect`, **Access Type** to `confidential`
3. Set **Valid Redirect URIs**: `https://<your-app>/auth/keycloak`
4. Under **Credentials**, note the **Secret**
5. Optionally configure realm roles or groups to restrict access

**Environment variables:**

```bash
NUXT_PUBLIC_REQUIRE_AUTH=true
NUXT_PUBLIC_AUTH_PROVIDERS=keycloak
NUXT_OAUTH_KEYCLOAK_CLIENT_ID=copilot-metrics-viewer
NUXT_OAUTH_KEYCLOAK_CLIENT_SECRET=xxxxxxxxxxxx
NUXT_OAUTH_KEYCLOAK_SERVER_URL=https://keycloak.company.com
NUXT_OAUTH_KEYCLOAK_REALM=your-realm

# Optional: restrict to specific users or email domain
NUXT_AUTHORIZED_USERS=alice,bob
NUXT_AUTHORIZED_EMAIL_DOMAINS=company.com
```

---

### Multiple Providers

You can enable multiple OAuth providers simultaneously. Users will see a sign-in button for each:

```bash
NUXT_PUBLIC_REQUIRE_AUTH=true
NUXT_PUBLIC_AUTH_PROVIDERS=github,google
NUXT_OAUTH_GITHUB_CLIENT_ID=...
NUXT_OAUTH_GITHUB_CLIENT_SECRET=...
NUXT_OAUTH_GOOGLE_CLIENT_ID=...
NUXT_OAUTH_GOOGLE_CLIENT_SECRET=...
```

---

### Authorization (user allowlists)

After a user authenticates with any provider, you can optionally restrict which accounts are allowed:

| Variable | Effect |
|---|---|
| `NUXT_AUTHORIZED_USERS` | Comma-separated logins or emails: `alice,bob@company.com` |
| `NUXT_AUTHORIZED_EMAIL_DOMAINS` | Comma-separated domains: `company.com,corp.org` |

When **both are empty** (default), all authenticated users are allowed. When either is set, a user must match at least one rule to gain access.

> [!NOTE]
> Provider-level restrictions (Microsoft tenant, Auth0 connections, Keycloak realm) are preferred over application-level allowlists — they deny access before reaching the app entirely.


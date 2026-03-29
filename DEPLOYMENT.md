# Deployment of Copilot Metrics Viewer

There are a few ways to deploy the Copilot Metrics Viewer, depending on the type of metrics (Organization/Enterprise) and the level of control required.

The app runs in a Docker container, so it can be deployed anywhere containers are hosted (AWS, GCP, Azure, Kubernetes, etc.).

## Architecture

The application consists of three components:

| Component | Description | Required |
|-----------|-------------|----------|
| **Web App** | Nuxt 3 dashboard (port 3000/80) | Yes |
| **PostgreSQL** | Database for historical metrics storage | Yes |
| **Sync Service** | Scheduled job that downloads metrics from GitHub API to PostgreSQL | Yes |

The sync service runs daily (2 AM UTC by default) and downloads the latest Copilot usage metrics from GitHub's async download API. The web app reads from the database for fast, reliable dashboard rendering.

> [!NOTE]
> **Legacy API mode**: Set `USE_LEGACY_API=true` to use the deprecated synchronous API (shutting down April 2, 2026). This mode does not require PostgreSQL but provides limited data.

## Deployment options

Review available [Nuxt Deployment Options](https://nuxt.com/deploy).

>[!WARNING]
> Copilot Metrics Viewer requires a backend, hence it cannot be deployed as a purely static web app.

## Authentication with GitHub

The Metrics Viewer can be integrated with GitHub application authentication, which authenticates the user and verifies their permissions to view the metrics. This option is recommended since it doesn't use Personal Access Tokens. The downside of using a GitHub application is that it can only authorize users to view metrics at the organization level (no support for Enterprise).

For Enterprise level authentication review [Github OAuth Apps](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps).

With a Personal Access Token, user credentials are not verified, and the application simply renders Copilot metrics fetched using the PAT stored in the backend.

## Authentication for Copilot Metrics Viewer

By default Azure Deployments deploy a web app available on the public Internet without authentication (unless GitHub app is used).

Application can be easily secured in azure using built-in features like Authentication settings on ACA/AppService (EasyAuth on Azure). Azure Container Apps and App Services allow for adding IP restrictions on ingress. Both can also be deployed using private networking architectures. 

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

### Running with Real GitHub Data

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

## Environment Variables Reference

| Variable | Description | Required |
|----------|-------------|----------|
| `NUXT_GITHUB_TOKEN` | GitHub PAT with Copilot metrics permission | Yes (unless OAuth) |
| `NUXT_PUBLIC_SCOPE` | `organization`, `enterprise`, or `team` | Yes |
| `NUXT_PUBLIC_GITHUB_ORG` | GitHub organization slug | For org scope |
| `NUXT_PUBLIC_GITHUB_ENT` | GitHub enterprise slug | For enterprise scope |
| `NUXT_PUBLIC_GITHUB_TEAM` | GitHub team slug | For team scope |
| `NUXT_SESSION_PASSWORD` | Session encryption key (min 32 chars) | Yes |
| `DATABASE_URL` | PostgreSQL connection string | Yes |
| `ENABLE_HISTORICAL_MODE` | `true` to read metrics from database | Yes |
| `SYNC_ENABLED` | `true` for sync service, `false` for web app | Per service |
| `SYNC_DAYS_BACK` | Days to sync (default: 1 for daily, 28 for bulk) | Sync only |
| `USE_LEGACY_API` | `true` to use deprecated API (no DB required) | Optional |
| `NUXT_PUBLIC_USING_GITHUB_AUTH` | `true` to enable GitHub OAuth | Optional |
| `NUXT_OAUTH_GITHUB_CLIENT_ID` | GitHub App client ID | For OAuth |
| `NUXT_OAUTH_GITHUB_CLIENT_SECRET` | GitHub App client secret | For OAuth |

## Github App Registration

While it is possible to run the API Proxy without GitHub app registration and with a hardcoded token, it is not the recommended way.

To register a new GitHub App, follow these steps:

> [!TIP]
> Navigate using link: replace `<your_org>` with your organization name and open this link:
[https://github.com/organizations/<your_org>/settings/apps](https://github.com/organizations/<your_org>/settings/apps)

or navigate using UI:
1. Go to your organization's settings.
2. Navigate to "Developer settings".
3. Select "GitHub Apps".
4. Click "New GitHub App".

1. Set a unique name.
2. Provide a home page URL: your company URL or just `http://localhost`.
3. Add a callback URL for `http://localhost:3000/auth/github`. (We'll add the real redirect URL after the application is deployed.)
4. Uncheck the "Webhook -> Active" checkbox.
5. Set the permissions:
   - Select **Organization permissions**.
   - Under **Members**, select **Access: Read-only**.
   - Under **Copilot Metrics**, select **Access: Read-only**.
   - Under **Copilot Seat Management**, select **Access: Read-only**.
6. Click on 'Create GitHub App' and, in the following page, click on 'Generate a new client secret'.
7. Note the `Client ID` and `Client Secret` (copy it to a secure location). This is required for the application to authenticate with GitHub.
8. Install the app in the organization:
   - Go to "Install App".
   - Select your organization.

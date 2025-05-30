# Deployment of Copilot Metrics Viewer

There are a few ways to deploy the Copilot Metrics Viewer, depending on the type of metrics (Organization/Enterprise) and the level of control required.

The app runs in a Docker container, so it can be deployed anywhere containers are hosted (AWS, GCP, Azure, Kubernetes, etc.).

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
* Azure Log Analytics Workspace

![Azure ARM Deployment](./azure-deploy/arm-deployment.png)

Application will use a pre-built docker image hosted in GitHub registry: `ghcr.io/github-copilot-resources/copilot-metrics-viewer`.

**Prerequisites:** Contributor permission to a resource group in Azure and a subscription with the `Microsoft.App` resource provider enabled.

> [!IMPORTANT]
> **Estimated cost** for running this in Azure is about $1 per month, as Container Apps have the first 2 million requests each month free.

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
- Contributor permission to a subscription in Azure with the `Microsoft.App` resource provider enabled.
- Permissions for creating role assignments.
- Azure CLI (az), Azure Developer CLI  (azd) and Docker installed locally.

> [!IMPORTANT]
> **Estimated cost** for running this in Azure is about $10 per month, Container Apps have the first 2 million requests each month free and Container Registry costs about $5.

The deployment creates:

* Azure Resource Group
* Azure Container App with a consumption environment
* Azure Container Registry
* Azure Log Analytics Workspace
* Azure Application Insights
* Azure Key Vault

![AZD Deployment](./azure-deploy/azd-deployment.png)

Run `azd up` and follow the prompts.

## Scenario 3: Deploying the container

Application can be deployed anywhere where containers can run and configured via environment variables:

For GitHub App:

```bash
docker run -it --rm -p 3000:80 \
-e NUXT_PUBLIC_SCOPE=organization \
-e NUXT_PUBLIC_GITHUB_ORG=<org name> \
-e NUXT_PUBLIC_USING_GITHUB_AUTH=true \
-e NUXT_OAUTH_GITHUB_CLIENT_ID=<client id> \
-e NUXT_OAUTH_GITHUB_CLIENT_SECRET=<client secret for the GH App> \
-e NUXT_SESSION_PASSWORD=<random string - min 32 characters>  \
ghcr.io/github-copilot-resources/copilot-metrics-viewer
```

or with PAT token and enterprise:

```bash
docker run -it --rm -p 3000:80 \
-e NUXT_PUBLIC_SCOPE=enterprise \
-e NUXT_PUBLIC_GITHUB_ENT=<enterprise name> \
-e NUXT_GITHUB_TOKEN=<github PAT> \
-e NUXT_SESSION_PASSWORD=<random string - min 32 characters>  \
ghcr.io/github-copilot-resources/copilot-metrics-viewer
```

or with PAT token and organization:

```bash
docker run -it --rm -p 3000:80 \
-e NUXT_PUBLIC_SCOPE=organization \
-e NUXT_PUBLIC_GITHUB_ORG=<org name> \
-e NUXT_GITHUB_TOKEN=<github PAT> \
-e NUXT_SESSION_PASSWORD=<random string - min 32 characters>   \
ghcr.io/github-copilot-resources/copilot-metrics-viewer
```

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
5. Set the scopes:
   - Select **Organization permissions**.
   - Under **GitHub Copilot Business**, select **Access: Read-only**.
6. Click on 'Create GitHub App' and, in the following page, click on 'Generate a new client secret'. (IMPORTANT: _**Save it for later**_)
7. Install the app in the organization:
   - Go to "Install App".
   - Select your organization.
8. Generate a new `Client Secret` and copy it to a secure location. This is required for the application to authenticate with GitHub.

Note the `Client ID` and `Client Secret`.

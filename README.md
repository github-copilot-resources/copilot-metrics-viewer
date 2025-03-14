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

## Setup Instructions

In the `.env` file, you can configure several environment variables that control the behavior of the application.

Public variables:
- `NUXT_PUBLIC_IS_DATA_MOCKED`
- `NUXT_PUBLIC_SCOPE`
- `NUXT_PUBLIC_GITHUB_ENT`
- `NUXT_PUBLIC_GITHUB_ORG`
- `NUXT_PUBLIC_GITHUB_TEAM`

can be overriden by route parameters, e.g.
- `http://localhost:3000/enterprises/octo-demo-ent`
- `http://localhost:3000/orgs/octo-demo-org`
- `http://localhost:3000/orgs/octo-demo-org/teams/the-a-team`
- `http://localhost:3000/orgs/mocked-org?mock=true`

#### NUXT_PUBLIC_SCOPE

The `NUXT_PUBLIC_SCOPE` environment variable in the `.env` file determines the default scope of the API calls made by the application. It can be set to 'enterprise', 'organization' or 'team'.

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

## License

This project is licensed under the terms of the MIT open source license. Please refer to [MIT](./LICENSE.txt) for the full terms.

## Maintainers

[@martedesco](https://github.com/martedesco) & [@karpikpl](https://github.com/karpikpl)

## Support

This project is independently developed and maintained, and is not an official GitHub product. It thrives through the dedicated efforts of ([@martedesco](https://github.com/martedesco)), ([@karpikpl](https://github.com/karpikpl)) and our wonderful contributors. A heartfelt thanks to all our contributors! ✨

I aim to provide support through [GitHub Issues](https://github.com/github-copilot-resources/copilot-metrics-viewer/issues). While I strive to stay responsive, I can't guarantee immediate responses. For critical issues, please include "CRITICAL" in the title for quicker attention. 🙏🏼

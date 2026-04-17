# Transparency Disclosures

**Copilot Metrics Viewer** — GitHub Marketplace Listing

Last updated: April 2026
Version: 3.2.0
Publisher: [github-copilot-resources](https://github.com/github-copilot-resources)
Source: [github-copilot-resources/copilot-metrics-viewer](https://github.com/github-copilot-resources/copilot-metrics-viewer)
License: MIT

---

## 1. Application Overview and Purpose

Copilot Metrics Viewer is a self-hosted web application that visualizes GitHub Copilot usage metrics and analytics for organizations and enterprises. It reads data from the [GitHub Copilot Usage Metrics API](https://docs.github.com/en/rest/copilot/copilot-metrics) and presents it through interactive charts and dashboards.

**What this application does:**

- Fetches and displays Copilot usage metrics (acceptance rates, active users, language breakdowns)
- Displays Copilot seat assignment and activity data
- Provides historical trend analysis when configured with a database
- Optionally offers an AI-powered chat interface for exploring metrics using natural language

**What this application does NOT do:**

- It does **not** generate, modify, or deploy code
- It does **not** make automated decisions or recommendations that affect users, repositories, or workflows
- It does **not** modify any data in your GitHub organization or enterprise
- It does **not** profile individuals — it displays aggregate and per-user usage statistics that are already available through GitHub's own APIs

---

## 2. Data Access and Permissions

### Authentication Modes

The application supports three authentication modes. The deployer chooses which mode to configure.

| Mode | How It Works | Token Storage |
|------|-------------|---------------|
| **Personal Access Token (PAT)** | A fine-grained PAT is set as a server-side environment variable (`NUXT_GITHUB_TOKEN`). All users share this token. | Server-side only; never exposed to the browser. |
| **GitHub App OAuth** | Users authenticate via GitHub OAuth. Only users with appropriate organization permissions can view metrics. | User session tokens are stored in encrypted cookies. |
| **Multitenant (OAuth only)** | No server-side token. Each user authenticates with their own GitHub credentials. | User tokens exist only in encrypted session cookies. |

### Required GitHub Permissions

The application requires **read-only** access to the following scopes:

- **Organization → Members** — Read
- **Organization → Copilot Metrics** — Read
- **Organization → Copilot Seat Management** — Read

No write permissions are requested or used. The application is strictly read-only with respect to the GitHub API.

### Optional AI Chat Permissions

If the AI chat feature is enabled (see [Section 5](#5-ai-feature-transparency)), an additional token (`NUXT_AI_TOKEN`) with **Models → Read** permission is required, or individual users may provide their own token.

---

## 3. Data Handling and Storage

### Data Flow

All data flows between the deployer's self-hosted instance and GitHub's APIs over HTTPS. No data is routed through the publisher's infrastructure or any intermediary.

```
GitHub APIs (api.github.com) ←→ [Your Infrastructure] Copilot Metrics Viewer ←→ User's Browser
```

### Storage Behavior

| Mode | Data Storage |
|------|-------------|
| **Direct API mode** (default) | No data is stored. Metrics are fetched from GitHub on each page load. |
| **Historical mode** (optional) | Metrics are cached in a PostgreSQL database hosted and managed entirely by the deployer, enabling data retention beyond the GitHub API's 28-day window. |

### What Is NOT Stored or Collected

- **No telemetry** is collected by the application
- **No analytics** are sent to the publisher or any third party
- **No usage tracking** of the application's own users
- **No phone-home** or external service calls beyond the GitHub APIs listed in [Section 6](#6-third-party-services)
- **AI chat conversations** are not persisted — they exist only in the browser session and are discarded when the page is closed

### Session Data

User session data is stored in encrypted cookies using the `NUXT_SESSION_PASSWORD` environment variable (minimum 32 characters). Session data contains only authentication state; it does not contain metrics or user data.

---

## 4. Security Mechanisms

| Mechanism | Description |
|-----------|-------------|
| **HTTPS only** | All API communication uses TLS-encrypted connections. |
| **Server-side token isolation** | In PAT mode, the GitHub token is stored as a server-side environment variable and is never sent to the browser. |
| **Session encryption** | User sessions are encrypted using a deployer-configured secret. |
| **Content Security Policy** | CSP headers are configured to mitigate cross-site scripting and injection attacks. |
| **No secrets in source code** | The codebase contains no embedded credentials or secrets. |
| **Self-hosted deployment** | The application runs entirely within the deployer's infrastructure. The publisher has no access to deployed instances. |
| **Open source** | The full source code is publicly available for security review (see [Section 8](#8-open-source-and-auditability)). |

### Responsible Disclosure

Security vulnerabilities can be reported through the repository's [security policy](https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/SECURITY.md).

---

## 5. AI Feature Transparency

> **This section applies only when the optional AI chat feature is enabled.**
> The AI chat feature can be fully disabled by setting `NUXT_PUBLIC_ENABLE_AI_CHAT=false`.

### How It Works

The AI chat feature (introduced in v3.2) allows users to ask natural language questions about the metrics data displayed on their dashboard. It uses the [GitHub Models API](https://docs.github.com/en/github-models) (`models.github.ai`) to generate conversational responses.

### Data Scope

- The AI model receives **only** the same metrics data that is already visible on the user's dashboard
- It does **not** have access to source code, repositories, pull requests, issues, or any data beyond Copilot usage metrics
- No additional GitHub API calls are made on behalf of the AI feature

### Data Retention

- AI chat conversations are **not stored** on the server or sent to the publisher
- Conversations exist only in the user's browser session and are discarded when the page is closed or refreshed
- Data sent to the GitHub Models API is subject to [GitHub's privacy statement](https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement) and the [GitHub Models terms](https://docs.github.com/en/github-models/responsible-use-of-github-models)

### Limitations

- The AI assistant provides informational responses about metrics data only
- It does **not** take actions, make changes, or execute commands
- It does **not** make personnel or management decisions
- Responses should be verified by the user — they are conversational summaries, not authoritative reports

---

## 6. Third-Party Services

The application communicates with the following external services only:

| Service | Purpose | When Used |
|---------|---------|-----------|
| **GitHub REST API** (`api.github.com`) | Fetching Copilot usage metrics and seat data | Always |
| **GitHub OAuth** (`github.com/login/oauth`) | User authentication | Only in OAuth / Multitenant modes |
| **GitHub Models API** (`models.github.ai`) | AI-powered metrics chat | Only when AI chat is enabled |

No other third-party services, analytics platforms, advertising networks, or tracking services are used.

---

## 7. Compliance and Risk Classification

### EU AI Act Classification

**Core application (metrics dashboard):** The Copilot Metrics Viewer dashboard is a **data visualization tool**. It displays pre-existing usage statistics retrieved from GitHub's API in chart and table form. It does not employ artificial intelligence techniques as defined under the [EU AI Act (Regulation 2024/1689)](https://eur-lex.europa.eu/eli/reg/2024/1689/oj). The core application is **not an AI system** and is outside the scope of the EU AI Act.

**Optional AI chat feature:** The AI chat functionality uses a large language model (via the GitHub Models API) to provide conversational responses about metrics data. Under the EU AI Act's risk-based classification framework:

- It does **not** perform biometric identification, social scoring, or emotion recognition
- It does **not** make decisions affecting natural persons' access to services, employment, or education
- It does **not** operate critical infrastructure or perform law enforcement functions
- It does **not** generate deepfakes or synthetic media intended to deceive
- It serves as a **general-purpose conversational assistant** for data exploration
- **Classification: Minimal risk** — not subject to high-risk AI system obligations under the EU AI Act

Users of the AI chat feature are informed that responses are generated by an AI model (the chat interface is clearly labeled as AI-powered).

### GitHub Marketplace Developer Agreement

This application is published in compliance with the [GitHub Marketplace Developer Agreement](https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement). In accordance with the agreement:

- The application's functionality and data practices are described accurately in this disclosure
- The application requests only the minimum permissions necessary for its stated functionality
- User data is handled in accordance with the publisher's privacy practices and GitHub's terms of service
- The application does not engage in deceptive practices or misrepresent its capabilities

---

## 8. Open Source and Auditability

Copilot Metrics Viewer is fully open source under the [MIT License](https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/LICENSE.txt).

- **Source code**: [github-copilot-resources/copilot-metrics-viewer](https://github.com/github-copilot-resources/copilot-metrics-viewer)
- **License**: MIT — permits use, modification, and distribution
- **Code review**: The entire codebase is publicly available for independent security audit
- **Contributions**: Community contributions are welcome under the project's [contributing guidelines](https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/CONTRIBUTING.md)

---

## 9. Contact and Reporting

- **Security issues**: Report via the repository's [security policy](https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/SECURITY.md)
- **Bugs and feature requests**: Open an [issue](https://github.com/github-copilot-resources/copilot-metrics-viewer/issues) on the repository
- **General questions**: Use [GitHub Discussions](https://github.com/github-copilot-resources/copilot-metrics-viewer/discussions) on the repository

---

*This document is provided as part of the GitHub Marketplace listing for Copilot Metrics Viewer. It is maintained alongside the application source code and updated with each release that changes the application's data handling, permissions, or AI capabilities.*

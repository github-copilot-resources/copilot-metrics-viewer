# Transparency Disclosures

**Copilot Metrics Viewer** · v3.2.0 · MIT License · [Source](https://github.com/github-copilot-resources/copilot-metrics-viewer)

## Overview

Self-hosted, read-only dashboard for GitHub Copilot usage metrics. Reads from the Copilot Usage Metrics API and displays charts/tables. Does NOT generate code, make automated decisions, or modify repositories.

## Permissions (Read-Only)

- Organization → Members: Read
- Organization → Copilot Metrics: Read
- Organization → Copilot Seat Management: Read

No write permissions requested. Optional AI chat needs Models → Read.

## Data Handling

- **Direct API mode**: No data stored; fetched from GitHub on each page load.
- **Historical mode** (optional): Cached in deployer-managed PostgreSQL for retention beyond 28 days.
- **No telemetry, analytics, or phone-home.** No data sent to publisher or third parties.
- AI conversations exist only in browser session — never stored server-side.
- Sessions use encrypted cookies (deployer-configured 32+ char secret).

## Security

- All API calls over HTTPS/TLS
- GitHub token server-side only, never exposed to browser
- Session encryption for auth state
- Content Security Policy headers
- No secrets in source code
- Self-hosted — publisher has no access to instances
- Open source for security audit

Report vulnerabilities via [SECURITY.md](https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/SECURITY.md).

## AI Chat (Optional)

Disabled by default. When enabled:
- Uses GitHub Models API for natural language Q&A about dashboard metrics
- AI sees ONLY metrics already visible on screen — no repo/code access
- Does not take actions or generate deployable code
- Conversations not persisted; discarded on page close
- Clearly labeled as AI-powered

## Third-Party Services

| Service | Purpose | When |
|---------|---------|------|
| GitHub REST API | Copilot metrics & seats | Always |
| GitHub OAuth | User auth | OAuth mode only |
| GitHub Models API | AI chat | When enabled |

No other external services, analytics, or tracking.

## EU AI Act Classification

**Dashboard**: Data visualization tool — not an AI system, outside EU AI Act scope.

**AI chat** (optional): Conversational data assistant. No biometric ID, social scoring, or automated decisions. **Minimal risk** (Articles 6, 8-17).

## Marketplace Compliance

Published per the [GitHub Marketplace Developer Agreement](https://docs.github.com/en/site-policy/github-terms/github-marketplace-developer-agreement). Minimum permissions requested. Data practices described accurately above.

## Contact

- Security: [SECURITY.md](https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/SECURITY.md)
- Bugs: [Issues](https://github.com/github-copilot-resources/copilot-metrics-viewer/issues)
- Questions: [Discussions](https://github.com/github-copilot-resources/copilot-metrics-viewer/discussions)

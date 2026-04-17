# Copilot Metrics Viewer — Marketplace Content

Character limits: Listing details ≤500, Detailed description ≤2000, Transparency disclosures ≤3000 (separate file).

---

## Listing Details (≤500 chars)

<!-- ≤500 chars -->
Self-hosted dashboard for GitHub Copilot usage analytics. Visualize acceptance rates, suggestions, active users, language breakdown, chat/agent activity, PR metrics, and seat analysis for your organization or enterprise. Includes per-user metrics, teams comparison, historical mode with PostgreSQL, date range filtering, CSV export, and optional AI chat. Read-only — never modifies repos. Deploy on Azure (one-click), Docker, or Kubernetes. Open source (MIT). Requires Copilot Metrics read access.

---

## Detailed Description (≤2000 chars)

<!-- 1978 chars -->
Copilot Metrics Viewer connects to the GitHub Copilot Usage Metrics API and presents your data through interactive charts and tables. It is read-only and self-hosted — data never leaves your infrastructure.

**Dashboard tabs:**
- Organization metrics: acceptance rate, suggestions, lines of code, active users
- Language breakdown: top languages by accepted prompts and acceptance rate
- Copilot Chat: turns, acceptances, active chat users
- Agent activity: code edits, completions, agent-generated lines of code
- Pull requests: PRs created, reviewed, and merged with Copilot
- GitHub.com: model usage analytics across IDE, chat, PR summaries
- Seat analysis: assigned, never used, inactive seats
- Per-user metrics: individual usage with Copilot LOC breakdown
- Teams comparison: compare adoption across teams

**Key capabilities:**
- Custom date range filtering (up to 100 days, exclude weekends/holidays)
- Historical mode with PostgreSQL for data beyond the 28-day API window
- Daily sync service for automated data collection
- CSV export (summary/full) and clipboard copy
- Optional AI chat powered by GitHub Models API — ask questions about your metrics
- Configurable tabs — hide sections you don't need

**Permissions required (Organization):**
- Members: Read-only
- Copilot Metrics: Read-only
- Copilot Seat Management: Read-only

**Authentication options:**
- GitHub App OAuth (recommended) — verifies user permissions
- Fine-grained PAT — server-side token
- Multitenant — each user authenticates with their own credentials

**Deployment:**
- One-click Azure (Container App + PostgreSQL, ~$15/month)
- Docker / Docker Compose
- Kubernetes with provided manifests
- Local development: npm install && npm run dev

Open source under MIT license. See DEPLOYMENT.md for setup and TRANSPARENCY_DISCLOSURES.md for security details.

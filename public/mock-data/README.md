# Mock contracts and provenance

These are demo/test inputs, not customer records or invoicing evidence.

## Billing

`billing-credits.json` is the synthetic **aggregate AI-credit baseline**.
The sanitized 2026-11-14 authenticated canary at source `ab5898d` observed
an enterprise envelope, native `ai-credits`, price `0.01`, fully discounted
items, and no item-level user attribution. Comparing current main (`e6a23e5`)
with that baseline found no intervening mock changes.

The fixture uses invented model/SKU labels and quantities, not customer taxonomy
or usage. Six rows cover full, partial, absent discounts and zero consumption;
the observed two-row response is not a universal row-count requirement.
Amounts equal native quantity times price in this controlled fixture, with
gross = discount + net for both quantities and amounts. This is not a rule for
arbitrary SKUs, historical units, or mixed-unit conversion.

`billing-credits-synthetic-attribution-demo.json` adds invented attribution
to the same six rows, so the per-user and ranking mock routes remain functional
and their amounts reconcile with the aggregate. Attribution is a demo
assumption, **not verified live behavior**.

`billing-credits-synthetic-attribution-stress.json` preserves the previous
110-row demo unchanged, including mixed requests/credits, broad model coverage,
and deliberately unverified per-user/organization attribution and arithmetic.
It is retained separately for explicit scale/edge tests, not served as the
default demo or claimed as an invoicing baseline. No live CSV, DB mapping, private ranking or
per-user discount reconciliation was validated (the live ranking probe hit
the application's DB-required 409 gate).

## Usage reports and seats

The first day in each organization aggregate fixture and the enterprise 28-day
fixture now includes representative documented client/model, Copilot app,
local BYOK active-user, custom-agent/MCP, and telemetry-coverage fields. Only
field shapes were taken from the sanitized comparison; all added values and
customization identifiers are synthetic. Optional fields remain absent on
other days to retain older-report compatibility. Existing feature, language,
model, CLI, null-seat-activity and larger report cases remain intact.

Rolling mock links and generated aggregate reports end on the previous UTC
day, simulating processing lag. Yesterday is not an availability guarantee:
GitHub documents processing within two full UTC days after a day closes, and
the canary contained only 24 active dates. Do not truncate all mocks to that
customer sample or require a record on every date. Explicit 1-day requests
still retain their requested date; static download files retain sample dates.

No `weekly_active_users <= monthly_active_users` invariant is asserted:
weekly counts use a seven-day window while monthly counts use the calendar
month, so the former is not necessarily a subset at a month boundary.
The existing synthetic example is retained, not labelled a universal API bug.
Enterprise-specific fixture correctness was not independently live-verified.

## Public references checked 2026-11-14

- [Billing response fields and separate AI-credit/premium-request endpoints](https://docs.github.com/en/rest/billing/usage?apiVersion=2026-03-10)
- [AI-credit unit: 1 credit = USD 0.01](https://docs.github.com/en/billing/concepts/product-billing/github-copilot-billing)
- [Metrics definitions](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/copilot-usage-metrics)
- [Report schema examples](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/example-schema)
- [Report windows](https://docs.github.com/en/rest/copilot/copilot-usage-metrics?apiVersion=2026-03-10)
- [Telemetry delay and reconciliation limits](https://docs.github.com/en/copilot/reference/copilot-usage-metrics/reconciling-usage-metrics)

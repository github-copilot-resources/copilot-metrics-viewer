# Bounded per-user billing pages

The Billing table uses `GET /api/billing-user-page`, not a downloaded Metrics
roster or the global top-spenders leaderboard. The legacy
`billing-credits-by-user` endpoint retains its explicit-login contract for other
consumers; it is not the table's pagination or authorization source.

## Required sources

Real pages are database-only. They require completed [usage coverage](roster-foundation.md)
for every requested usage date, ingested enterprise billing CSV coverage, and,
for a team, a published current membership snapshot. At exactly 24 hours a
membership snapshot is stale. Virtual `reports-to:` teams are unavailable
without an authoritative server resolver; client `users` lists cannot establish
membership. Missing, stale, failed or in-flight sources return an explicit
unavailable response. Requests never initiate report downloads or membership
traversals. Organization views require the existing billing-enterprise mapping.

Billing identity is deliberately conservative. Canonical usernames and explicit
`NUXT_BILLING_USER_ALIASES` mappings are used, never guessed EMU suffixes.
An unmatched or unattributed source identity makes billing amounts unavailable,
not zero. A roster user without a matched source identity is also unavailable.
User/CLI-token order remains usable with nullable billing cells; billing-column
sorts return `billing-attribution-unavailable` unless **every permitted user**
has verified identity-backed amounts. Source identities are checked against the
covered base roster (and selected team members), without returning unknown
billing usernames. This can make billing unavailable when the usage and billing
windows contain different users; choose appropriate covered windows or correct
the explicit operator aliases rather than treating absence as zero.

Zero is valid for an explicit source zero or a verified identity whose complete
billing export has no entries matching the selected model/SKU/product/repository
filter. An empty export alone does not certify per-user attribution. An
overlapping newer failed/in-flight CSV job is not certified by an older completed
job. No live fan-out or loaded-only sorting fallback is used.

## Page contract

`usageSince` and `usageUntil` are explicit, independent of the existing billing
`since`/`until` or `year`/`month`/`day`. Windows are validated and limited to 366
days. Existing billing-admin and team gates run before reading snapshots;
metrics/seats self-only restrictions are unchanged.

`page` is a positive integer; `itemsPerPage` is 1–50. `sortKey` supports `user`,
`tokens`, `credits`, `grossAmount`, `netAmount`, and `models`; `sortOrder` is
`asc` or `desc`. Organization scope always restricts billing organization.
Optional `organization`, `repository`, `model`, `sku`, and `product` filters are
applied server-side. Client roster lists, unsupported cost-center IDs and search
are rejected, not silently interpreted as authoritative filters. This does not
implement #431 seat pagination or #437 global search.

The response contains at most 50 compact `rows`, a permitted `total`, pagination,
`version`, and `billingSortAvailable`. It contains no report JSON or full login
list. Rows sum **all** relevant items per canonical user before ordering and
paging; model counts are distinct across those items. Ties use canonical login
with PostgreSQL `"C"` collation. Net and gross remain separate; the independent
global chart retains its explicit gross fallback.

Each read pins usage date/publication pairs, team version, billing completion,
scope, windows, filters and aliases in one repeatable-read transaction. Subsequent
page/sort requests send `version`; changed publications return `dataset-changed`
and restart at page 1. Historical versions are not silently concatenated.

The UI renders server order, preserves sort intent and total during paging,
replaces rather than accumulates amounts, ignores stale responses and clears
rows on failure. Retry is explicit. The CLI-token chart is labeled **current
page**, not global. Mock mode uses an explicitly synthetic attribution demo and
does not publish authoritative coverage.

## Validation

```sh
npm test -- --run --config tests/billing-user-page.config.ts
```

This owns a disposable PostgreSQL16 container on a random loopback port.
`PR430_BROWSER=1` additionally runs native Chromium against an owned Nuxt server
on port 3221, with the actual SQL page endpoint and synthetic source records.
The browser evidence goes to `PR430_EVIDENCE_DIR` when provided; no cookies,
storage state, live records, HARs or video are retained.

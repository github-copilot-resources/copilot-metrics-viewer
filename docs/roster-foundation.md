# Authoritative roster storage foundation

This is the storage/sync prerequisite for #430, not a billing page, public API,
or replacement for current metrics/seats readers. #431 pagination and #437 search
are not implemented here. Existing metrics/seats roles and self-only restrictions
are unchanged. No new credentials or identity-provider permissions are required.

## Current membership

`syncTeamMembership` is a worker-side publisher, called during existing team
bulk/daily syncs. It uses the same GitHub organization `/members` or enterprise
`/memberships` source as the existing team helper. Enterprise organization teams
can also be published by supplying `githubOrg` to this internal helper. The
namespace is part of the storage key, alongside base scope, identifier, team kind
and team key. No team inventory is discovered automatically: the existing sync
job must target each required team, initially and at least daily. A base-only
scheduled sync does not discover or refresh arbitrary team memberships.

Each upstream page contains at most 100 members and is stored before fetching the
next page. The publisher normalizes logins and retains members regardless of
usage activity; a seat's `assigning_team` is never consulted. Flat and nested
GitHub membership objects are supported. Invalid pages fail the attempt instead
of being mistaken for the end of pagination.

Rows are staged under a private UUID version. Only a successful terminal page
allows the short publication transaction to complete the header and change the
published pointer together. Network I/O is outside database transactions. A late
older traversal cannot replace a more recently fetched snapshot.

Freshness is measured from the clock instant **after the last successful upstream
page** (`fetched_at`), not DB commit or retry time. At exactly 24 hours it is stale.
A failed refresh keeps an old published snapshot usable only for its remaining
freshness interval. Missing, first-attempt failure and stale data return explicit
`membership-unavailable` / `membership-stale`, never an empty roster. A successfully
fetched empty team is an available zero-member snapshot.

**Virtual `reports-to:` teams are unavailable.** There is no authoritative
server-resolved tenant/manager dataset in the current application. Neither client
`users` / `reportToLogins` lists nor the mock identity tree can publish a snapshot.
There is deliberately no new HR/IdP source, token requirement or fallback.

## Per-user usage coverage

Bulk and single-day per-user ingestion use the existing GitHub report-link
endpoint, then sequentially stream every signed report part as NDJSON.
The source response must supply `report_day` or a valid
`report_start_day` / `report_end_day`. Missing links, missing/mismatched window
metadata, malformed/truncated records, preaggregated-only reports, unsafe token
numbers, out-of-window rows and failed downloads are **not coverage**. Record
minima/maxima and aggregate report success cannot establish complete coverage.
Multi-day records must declare the same start/end window as the report links.
Single-day records may omit both fields; if either is supplied, both must match
the link window. Contradictory parts cannot replace existing date publications.
An omitted `totals_by_cli` means no CLI activity and contributes zero tokens.
A present CLI object must contain `token_usage` with both nonnegative safe
integer sums (`prompt_tokens_sum` and `output_tokens_sum`); missing/null token
payloads or sums are not verified zero. Explicit numeric zeros are valid.

The stream parser bounds each line to 1 MiB and storage batches to 1,000 user-day
rows. It does not collect every part or the complete report in an application
array. Existing raw `user_day_metrics` writes are retained for existing readers.
New `user_usage_rows` contain only version, date, normalized login, optional ID
and scalar CLI prompt/output tokens; they contain no report JSON.

Each part is marked stored only after its legacy **and** compact writes finish.
Only after all expected parts succeed does a short transaction complete the
version and atomically publish all covered dates. An HTTP-successful empty part
(empty NDJSON or `[]`) within an authoritative window is valid: all-empty reports
publish verified zero-row coverage. No links or unrecognized data is not empty.
Fetch, storage, publication or transaction-commit failure never exposes staged
rows. Aggregate sync remains non-fatal on per-user failures, without promoting
aggregate status into user coverage.

Coverage is keyed by exact base scope, identifier, date and immutable version.
An arbitrary requested window is available only if **every date** is covered;
overlapping complete reports may supply different versions for different dates.
Newer attempts cannot be overwritten by late older attempts. Historical completed
coverage does not expire after 24 hours. Single-day sync skips already completed
coverage, including verified empty days; legacy row existence alone never skips a
needed coverage backfill. Legacy installations start with missing coverage and
must re-sync source reports to establish it. Mock reports cannot publish
authoritative metadata.

## Internal read contract and migration

`initSchema` additively creates the snapshot, staged-row, part-completion and
publication tables. It does not change CSV writers, existing tables or backfill
completeness from historical rows. Failed/older versions are retained; this
change does not introduce a broad cleanup job.

`getMembershipSnapshot` returns compact version/source/fetch/completion/count
metadata. `getMembershipPage` uses a parameterized version predicate, deterministic
`"C"` collation, a login cursor and a hard limit of 100 compact rows (default
callers must choose their limit). Reads never contact GitHub. Each result includes
its version; a caller paging across a concurrent publication must detect a
version change and restart rather than concatenate different snapshots.
`getUsageCoverage` returns at most 366 date/version pairs for an exact 1–366-day
window. This is coverage metadata, not a materialized usage roster.

Future #430 SQL must join each `user_usage_publications` date/version to compact
usage rows, intersect the fresh selected team version, then aggregate/order/count
and limit in SQL. Pin/verify the selected versions in the same read contract;
never select complete report JSON or a complete login list into JavaScript.
Only complete usage coverage plus a fresh complete membership can establish
inactive-member usage zero. Billing zero separately requires verified billing
coverage, which this foundation does not add.

These are internal storage helpers, not authorization boundaries. Any future
route must retain its usage-admin/team-membership gates **before** reading these
datasets, scoped to the requested organization/enterprise/team. This foundation
adds no public roster endpoint and does not authorize exposing roster details.

## Validation

```sh
npm test -- --run --config tests/roster-foundation.config.ts
```

Requires Docker and `postgres:16-alpine`. The suite owns its ephemeral container
and random loopback port, uses only synthetic data, and never uses an application
database. It exercises fresh/legacy initialization, 601-member streamed
publication, bounded pages, isolation, freshness boundaries, virtual unavailability,
all-part completion, empty windows, retries and real deferred-COMMIT failures.

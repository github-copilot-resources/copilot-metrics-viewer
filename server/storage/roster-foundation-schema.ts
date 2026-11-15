import type pg from 'pg';

/** Additive only: pre-existing user rows deliberately receive no coverage. */
export async function initRosterFoundationSchema(pool: pg.Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS team_membership_snapshots (
      version UUID PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('organization', 'enterprise')),
      identifier TEXT NOT NULL,
      team_kind TEXT NOT NULL CHECK (team_kind = 'github'),
      source TEXT NOT NULL DEFAULT 'github' CHECK (source = 'github'),
      team_key TEXT NOT NULL,
      github_org TEXT NOT NULL DEFAULT '',
      state TEXT NOT NULL DEFAULT 'staging' CHECK (state IN ('staging', 'complete', 'failed')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      fetched_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS team_membership_rows (
      version UUID NOT NULL REFERENCES team_membership_snapshots(version),
      normalized_login TEXT NOT NULL CHECK (normalized_login <> '' AND normalized_login = lower(btrim(normalized_login))),
      user_id BIGINT,
      PRIMARY KEY (version, normalized_login)
    );
    CREATE TABLE IF NOT EXISTS team_membership_publications (
      scope TEXT NOT NULL,
      identifier TEXT NOT NULL,
      team_kind TEXT NOT NULL,
      team_key TEXT NOT NULL,
      github_org TEXT NOT NULL DEFAULT '',
      version UUID NOT NULL REFERENCES team_membership_snapshots(version),
      PRIMARY KEY (scope, identifier, team_kind, team_key, github_org)
    );
    CREATE TABLE IF NOT EXISTS user_usage_snapshots (
      version UUID PRIMARY KEY,
      scope TEXT NOT NULL CHECK (scope IN ('organization', 'enterprise')),
      identifier TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'github-user-report' CHECK (source = 'github-user-report'),
      since DATE NOT NULL,
      until DATE NOT NULL CHECK (until >= since AND until - since < 366),
      expected_parts INT NOT NULL CHECK (expected_parts > 0),
      state TEXT NOT NULL DEFAULT 'staging' CHECK (state IN ('staging', 'complete', 'failed')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
      fetched_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS user_usage_rows (
      version UUID NOT NULL REFERENCES user_usage_snapshots(version),
      metrics_date DATE NOT NULL,
      normalized_login TEXT NOT NULL CHECK (normalized_login <> '' AND normalized_login = lower(btrim(normalized_login))),
      user_id BIGINT,
      prompt_tokens NUMERIC NOT NULL CHECK (prompt_tokens >= 0),
      output_tokens NUMERIC NOT NULL CHECK (output_tokens >= 0),
      PRIMARY KEY (version, metrics_date, normalized_login)
    );
    CREATE TABLE IF NOT EXISTS user_usage_parts (
      version UUID NOT NULL REFERENCES user_usage_snapshots(version),
      part_index INT NOT NULL CHECK (part_index >= 0),
      PRIMARY KEY (version, part_index)
    );
    CREATE TABLE IF NOT EXISTS user_usage_publications (
      scope TEXT NOT NULL,
      identifier TEXT NOT NULL,
      metrics_date DATE NOT NULL,
      version UUID NOT NULL REFERENCES user_usage_snapshots(version),
      PRIMARY KEY (scope, identifier, metrics_date)
    );
  `);
}

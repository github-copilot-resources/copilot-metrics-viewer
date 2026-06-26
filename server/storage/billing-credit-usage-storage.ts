/**
 * Storage helpers for billing_credit_usage — line-level rows from the
 * GitHub async billing CSV export.
 *
 * Upserts are idempotent: re-ingesting an overlapping date range updates
 * the numeric columns from the latest CSV (float-precision drift in the
 * 14th decimal is sub-penny and acceptable).
 */

import { getPool } from './db';

export interface BillingCreditRow {
  enterprise: string;
  date: string;                       // YYYY-MM-DD
  product: string;
  sku: string;
  username: string;                   // '' for un-attributed rows
  organization: string;
  repository: string;
  cost_center_name: string;
  model: string;
  unit_type: string;
  applied_cost_per_quantity: number;
  quantity: number;
  gross_amount: number;
  net_amount: number;
  discount_amount: number;
  aic_quantity: number;
  aic_gross_amount: number;
  total_monthly_quota: number;
}

const UPSERT_COLUMNS = [
  'enterprise', 'date', 'product', 'sku', 'username',
  'organization', 'repository', 'cost_center_name', 'model',
  'unit_type', 'applied_cost_per_quantity', 'quantity',
  'gross_amount', 'net_amount', 'discount_amount',
  'aic_quantity', 'aic_gross_amount', 'total_monthly_quota',
] as const;

/**
 * Bulk upsert. Rows MUST all be for the same enterprise (no cross-tenant mixing).
 * Uses a single multi-row INSERT ... ON CONFLICT for efficiency — Postgres handles
 * batches of several thousand rows fine in one statement.
 *
 * Returns the number of rows actually written (Postgres counts inserts+updates
 * the same way through `rowCount`).
 */
export async function upsertBillingCreditRows(rows: BillingCreditRow[]): Promise<number> {
  if (rows.length === 0) return 0;

  const pool = getPool();

  // Build a flat parameter list — 18 params per row.
  const valuesSql: string[] = [];
  const params: unknown[] = [];
  rows.forEach((row, i) => {
    const base = i * UPSERT_COLUMNS.length;
    const placeholders = UPSERT_COLUMNS.map((_, j) => `$${base + j + 1}`).join(',');
    valuesSql.push(`(${placeholders})`);
    params.push(
      row.enterprise, row.date, row.product, row.sku, row.username,
      row.organization, row.repository, row.cost_center_name, row.model,
      row.unit_type, row.applied_cost_per_quantity, row.quantity,
      row.gross_amount, row.net_amount, row.discount_amount,
      row.aic_quantity, row.aic_gross_amount, row.total_monthly_quota,
    );
  });

  const updateSet = UPSERT_COLUMNS
    .filter(c => !['enterprise', 'date', 'sku', 'username', 'organization', 'repository', 'model'].includes(c))
    .map(c => `${c} = EXCLUDED.${c}`)
    .concat(['ingested_at = NOW()'])
    .join(', ');

  const sql = `
    INSERT INTO billing_credit_usage (${UPSERT_COLUMNS.join(',')})
    VALUES ${valuesSql.join(',')}
    ON CONFLICT (enterprise, date, sku, username, organization, repository, model)
    DO UPDATE SET ${updateSet}
  `;

  const result = await pool.query(sql, params);
  return result.rowCount ?? rows.length;
}

/**
 * Delete every row for an (enterprise, date-range) window. Used by ingester
 * before re-upserting so a row that DISAPPEARS from the CSV (e.g. correction
 * upstream) doesn't linger forever. Wrapped in the same transaction as the
 * upsert by the caller.
 */
export async function deleteBillingCreditRowsForRange(
  enterprise: string,
  startDate: string,
  endDate: string,
): Promise<number> {
  const pool = getPool();
  const result = await pool.query(
    `DELETE FROM billing_credit_usage
     WHERE enterprise = $1 AND date >= $2 AND date <= $3`,
    [enterprise, startDate, endDate],
  );
  return result.rowCount ?? 0;
}

/** Total row count for a given enterprise (mainly for tests / admin overview). */
export async function countBillingCreditRows(enterprise: string): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM billing_credit_usage WHERE enterprise = $1`,
    [enterprise],
  );
  return rows[0]?.n ?? 0;
}

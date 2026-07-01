// @vitest-environment node
/**
 * Regression test for the user-reported failure:
 *   ON CONFLICT DO UPDATE command cannot affect row a second time
 *
 * This happens when the upsert batch contains two rows sharing the same
 * primary key (enterprise, date, sku, username, organization, repository,
 * model) but differing in non-PK columns (most often cost_center_name).
 *
 * `collapseByPrimaryKey` dedupes the batch before it ever reaches pg.
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../server/storage/db', () => ({
  getPool: () => ({ query: vi.fn() }),
  initSchema: vi.fn(),
  closePool: vi.fn(),
}));

import {
  collapseByPrimaryKey,
  type BillingCreditRow,
} from '../server/storage/billing-credit-usage-storage';

function row(over: Partial<BillingCreditRow> = {}): BillingCreditRow {
  return {
    enterprise: 'ent',
    date: '2026-04-15',
    product: 'copilot',
    sku: 'copilot_ai_credit',
    username: 'alice',
    organization: 'org-a',
    repository: '',
    cost_center_name: '',
    model: 'gpt-4o',
    unit_type: 'credits',
    applied_cost_per_quantity: 0.04,
    quantity: 10,
    gross_amount: 0.4,
    net_amount: 0.4,
    discount_amount: 0,
    aic_quantity: 10,
    aic_gross_amount: 0.4,
    total_monthly_quota: 1000,
    ...over,
  };
}

describe('collapseByPrimaryKey', () => {
  it('passes through a single-row batch unchanged', () => {
    const r = row();
    expect(collapseByPrimaryKey([r])).toEqual([r]);
  });

  it('passes through rows with distinct PKs unchanged (just sorted)', () => {
    const r1 = row({ date: '2026-04-15' });
    const r2 = row({ date: '2026-04-16' });
    const result = collapseByPrimaryKey([r2, r1]);
    expect(result).toHaveLength(2);
    expect(result[0]!.date).toBe('2026-04-15');
    expect(result[1]!.date).toBe('2026-04-16');
  });

  it('sums numerics for rows sharing the PK (cost-center split case)', () => {
    // The user-reported scenario: same (date, sku, user, model, org, repo)
    // appearing twice with different cost_center_name allocations.
    const a = row({ cost_center_name: 'CC-A', quantity: 6, gross_amount: 0.24,
      net_amount: 0.24, aic_quantity: 6, aic_gross_amount: 0.24 });
    const b = row({ cost_center_name: 'CC-B', quantity: 4, gross_amount: 0.16,
      net_amount: 0.16, aic_quantity: 4, aic_gross_amount: 0.16 });

    const result = collapseByPrimaryKey([a, b]);
    expect(result).toHaveLength(1);
    expect(result[0]!.quantity).toBeCloseTo(10, 6);
    expect(result[0]!.gross_amount).toBeCloseTo(0.40, 6);
    expect(result[0]!.net_amount).toBeCloseTo(0.40, 6);
    expect(result[0]!.aic_quantity).toBeCloseTo(10, 6);
    expect(result[0]!.aic_gross_amount).toBeCloseTo(0.40, 6);
    // First non-empty cost_center_name wins
    expect(result[0]!.cost_center_name).toBe('CC-A');
  });

  it('sums discount_amount and total_monthly_quota too', () => {
    const a = row({ discount_amount: 0.1, total_monthly_quota: 500 });
    const b = row({ discount_amount: 0.05, total_monthly_quota: 500 });
    const [merged] = collapseByPrimaryKey([a, b]);
    expect(merged!.discount_amount).toBeCloseTo(0.15, 6);
    expect(merged!.total_monthly_quota).toBe(1000);
  });

  it('takes MAX of applied_cost_per_quantity (peak price)', () => {
    const a = row({ applied_cost_per_quantity: 0.04 });
    const b = row({ applied_cost_per_quantity: 0.10 });
    const [merged] = collapseByPrimaryKey([a, b]);
    expect(merged!.applied_cost_per_quantity).toBe(0.10);
  });

  it('does not collapse rows differing in model (PK column)', () => {
    const a = row({ model: 'gpt-4o' });
    const b = row({ model: 'claude-sonnet-4' });
    expect(collapseByPrimaryKey([a, b])).toHaveLength(2);
  });

  it('does not collapse rows differing in repository (PK column)', () => {
    const a = row({ repository: '' });
    const b = row({ repository: 'org-a/repo-1' });
    expect(collapseByPrimaryKey([a, b])).toHaveLength(2);
  });

  it('treats empty-string username as a valid PK component (no merge with other users)', () => {
    const a = row({ username: '' });
    const b = row({ username: 'alice' });
    expect(collapseByPrimaryKey([a, b])).toHaveLength(2);
  });

  it('handles many duplicates correctly (stress)', () => {
    const rows: BillingCreditRow[] = [];
    for (let i = 0; i < 100; i++) {
      rows.push(row({ cost_center_name: `CC-${i % 5}`, quantity: 1 }));
    }
    const result = collapseByPrimaryKey(rows);
    expect(result).toHaveLength(1);
    expect(result[0]!.quantity).toBe(100);
  });
});

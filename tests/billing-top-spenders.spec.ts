// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildTopSpendersChartData } from '../app/utils/billingTopSpenders';

describe('buildTopSpendersChartData', () => {
  it('falls back to gross spend when every loaded user has zero net spend', () => {
    const result = buildTopSpendersChartData([
      { user: 'alice', grossAmount: 25, netAmount: 0 },
      { user: 'bob', grossAmount: 100, netAmount: 0 },
    ], '#3f51b5');

    expect(result).toMatchObject({
      labels: ['bob', 'alice'],
      datasets: [
        {
          label: 'Gross spend (USD)',
          data: [100, 25],
        },
      ],
    });
  });

  it('continues ranking by net spend when any loaded user has net spend', () => {
    const result = buildTopSpendersChartData([
      { user: 'alice', grossAmount: 100, netAmount: 5 },
      { user: 'bob', grossAmount: 25, netAmount: 10 },
    ], '#3f51b5');

    expect(result).toMatchObject({
      labels: ['bob', 'alice'],
      datasets: [
        {
          label: 'Net spend (USD)',
          data: [10, 5],
        },
      ],
    });
  });
});

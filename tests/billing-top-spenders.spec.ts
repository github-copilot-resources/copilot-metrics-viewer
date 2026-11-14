// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { buildTopSpendersChartData } from '../app/utils/billingTopSpenders';

describe('buildTopSpendersChartData', () => {
  it('plots the globally selected gross metric without calling it net', () => {
    const result = buildTopSpendersChartData([
      { user: 'alice', grossAmount: 25, netAmount: 0 },
      { user: 'bob', grossAmount: 100, netAmount: 0 },
    ], '#3f51b5', 'grossAmount');

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

  it('never infers global fallback from zero-net client rows', () => {
    expect(buildTopSpendersChartData([
      { user: 'alice', grossAmount: 100, netAmount: 0 },
    ], '#3f51b5', 'netAmount')).toBeNull();
  });

  it('keeps empty, zero-gross and nonfinite activity neutral', () => {
    expect(buildTopSpendersChartData([], '#3f51b5', 'grossAmount')).toBeNull();
    expect(buildTopSpendersChartData([
      { user: 'alice', grossAmount: 0, netAmount: 0 },
      { user: 'bob', grossAmount: NaN, netAmount: NaN },
    ], '#3f51b5', 'grossAmount')).toBeNull();
  });

  it('uses deterministic user ties and limits the chart to ten', () => {
    const result = buildTopSpendersChartData(Array.from({ length: 12 }, (_, i) => ({
      user: `user-${String(11 - i).padStart(2, '0')}`, netAmount: 1, grossAmount: i,
    })), '#3f51b5', 'netAmount');
    expect(result?.labels).toEqual(Array.from({ length: 10 }, (_, i) => `user-${String(i).padStart(2, '0')}`));
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

export interface BillingTopSpenderRow {
  user: string;
  grossAmount: number;
  netAmount: number;
}

export function buildTopSpendersChartData(
  rows: BillingTopSpenderRow[],
  backgroundColor: string,
  spendKey: 'netAmount' | 'grossAmount' = 'netAmount',
) {
  const label = spendKey === 'netAmount' ? 'Net spend (USD)' : 'Gross spend (USD)';
  const withSpend = rows.filter((row) => {
    const amount = Number.isFinite(row[spendKey]) ? row[spendKey] : 0;
    return amount > 0;
  });
  if (withSpend.length === 0) return null;

  const top = [...withSpend]
    .sort((a, b) => {
      const spendDiff = b[spendKey] - a[spendKey];
      return spendDiff || a.user.localeCompare(b.user);
    })
    .slice(0, 10);

  return {
    labels: top.map(row => row.user),
    datasets: [
      {
        label,
        data: top.map(row => +row[spendKey].toFixed(2)),
        backgroundColor,
        borderRadius: 4,
      },
    ],
  };
}

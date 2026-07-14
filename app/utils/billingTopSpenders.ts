export interface BillingTopSpenderRow {
  user: string;
  grossAmount: number;
  netAmount: number;
}

export function buildTopSpendersChartData(
  rows: BillingTopSpenderRow[],
  backgroundColor: string,
) {
  const maxNetAmount = rows.reduce((max, row) => {
    const netAmount = Number.isFinite(row.netAmount) ? row.netAmount : 0;
    return Math.max(max, netAmount);
  }, 0);
  const spendKey: 'netAmount' | 'grossAmount' = maxNetAmount > 0 ? 'netAmount' : 'grossAmount';
  const label = spendKey === 'netAmount' ? 'Net spend (USD)' : 'Gross spend (USD)';
  const withSpend = rows.filter((row) => {
    const amount = Number.isFinite(row[spendKey]) ? row[spendKey] : 0;
    return amount > 0;
  });
  if (withSpend.length === 0) return null;

  const top = [...withSpend]
    .sort((a, b) => {
      const spendDiff = b[spendKey] - a[spendKey];
      return spendDiff || b.grossAmount - a.grossAmount;
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

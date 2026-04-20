/**
 * Shared Chart.js plugins and constants used across dashboard components.
 */

export const PALETTE = [
  { bg: 'rgba(54, 162, 235, 0.75)',  border: 'rgb(54, 162, 235)'  },
  { bg: 'rgba(255, 99, 132, 0.75)',  border: 'rgb(255, 99, 132)'  },
  { bg: 'rgba(75, 192, 192, 0.75)',  border: 'rgb(75, 192, 192)'  },
  { bg: 'rgba(153, 102, 255, 0.75)', border: 'rgb(153, 102, 255)' },
  { bg: 'rgba(255, 159, 64, 0.75)',  border: 'rgb(255, 159, 64)'  },
  { bg: 'rgba(180, 180, 180, 0.60)', border: 'rgb(180, 180, 180)' },
  { bg: 'rgba(255, 205, 86, 0.75)',  border: 'rgb(255, 205, 86)'  },
  { bg: 'rgba(201, 203, 207, 0.75)', border: 'rgb(201, 203, 207)' },
];

export const PIE_COLORS = [
  '#4B0082', '#41B883', '#6495ED', '#87CEFA', '#7CFC00', '#FF7043', '#AB47BC', '#26C6DA',
];

/** Shades weekend (Sat/Sun) columns on any date-labelled chart. */
export const weekendPlugin = {
  id: 'weekendHighlight',
  beforeDraw(chart: any) {
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x) return;
    const labels: string[] = chart.data.labels ?? [];
    const xScale = scales.x;
    const bw = labels.length > 1 ? (xScale.getPixelForValue(1) - xScale.getPixelForValue(0)) : 20;
    ctx.save();
    ctx.fillStyle = 'rgba(128,128,128,0.10)';
    labels.forEach((label, i) => {
      const d = new Date(label as string);
      if (d.getDay() === 0 || d.getDay() === 6) {
        const x = xScale.getPixelForValue(i);
        ctx.fillRect(x - bw / 2, chartArea.top, bw, chartArea.bottom - chartArea.top);
      }
    });
    ctx.restore();
  }
};

/** Replaces flat rgba backgrounds with a top-to-bottom gradient for Line charts with fill:true. */
export const gradientFillPlugin = {
  id: 'gradientFill',
  beforeDatasetsUpdate(chart: any) {
    const { ctx, chartArea } = chart;
    if (!chartArea) return;
    chart.data.datasets.forEach((dataset: any) => {
      if (!dataset.fill || !dataset.borderColor || typeof dataset.borderColor !== 'string') return;
      const bc: string = dataset.borderColor;
      const withAlpha = (c: string, a: number) =>
        c.startsWith('rgb(') ? c.replace('rgb(', 'rgba(').replace(')', `, ${a})`) : c;
      const grad = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
      grad.addColorStop(0, withAlpha(bc, 0.45));
      grad.addColorStop(1, withAlpha(bc, 0.03));
      dataset.backgroundColor = grad;
    });
  }
};

/** Base options for a responsive time-series chart (maintainAspectRatio: false). */
export function makeLineOptions(extra: Record<string, any> = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    scales: {
      x: { ticks: { maxTicksLimit: 14 } },
      y: { beginAtZero: true },
    },
    plugins: { legend: { position: 'bottom' as const } },
    ...extra,
  };
}

/** Base options for a responsive bar chart (maintainAspectRatio: false). */
export function makeBarOptions(extra: Record<string, any> = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { ticks: { maxTicksLimit: 14 } },
      y: { beginAtZero: true },
    },
    plugins: { legend: { position: 'bottom' as const } },
    ...extra,
  };
}

export function formatCompact(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

<template>
  <div>
    <!-- Info panel -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-4 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">💳 AI Credit Usage</div>
          <div class="text-medium-emphasis">
            Billing breakdown for AI credit consumption across models and products. Shows gross usage,
            discounts, and net cost in dollars. Requires "Administration" read permission on your organization.
          </div>
        </div>
        <v-divider vertical class="mx-2 hidden-sm-and-down" />
        <div class="d-flex flex-column gap-1 flex-shrink-0">
          <div class="text-caption text-medium-emphasis font-weight-medium mb-1">LEARN MORE</div>
          <a href="https://docs.github.com/en/rest/billing/usage?apiVersion=2026-03-10#get-billing-ai-credit-usage-report-for-an-organization"
             target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">AI Credit Usage API docs</span>
          </a>
          <a href="https://docs.github.com/en/billing/using-the-new-billing-platform"
             target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Enhanced billing platform</span>
          </a>
        </div>
      </div>
    </v-card>

    <!-- Period selector -->
    <div class="mx-4 mb-3 d-flex align-center gap-3 flex-wrap">
      <v-select
        v-model="selectedYear"
        :items="availableYears"
        label="Year"
        density="compact"
        variant="outlined"
        style="max-width: 130px;"
        hide-details
        @update:model-value="fetchData"
      />
      <v-select
        v-model="selectedMonth"
        :items="months"
        item-title="label"
        item-value="value"
        label="Month"
        density="compact"
        variant="outlined"
        style="max-width: 160px;"
        hide-details
        clearable
        @update:model-value="fetchData"
      />
      <v-btn
        variant="tonal"
        size="small"
        prepend-icon="mdi-refresh"
        :loading="loading"
        @click="fetchData"
      >Refresh</v-btn>
      <span v-if="timePeriodLabel" class="text-caption text-medium-emphasis ml-auto">
        Showing data for: <strong>{{ timePeriodLabel }}</strong>
      </span>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 200px;">
      <v-progress-circular indeterminate size="64" color="primary" />
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="mx-4">
      <v-alert type="warning" variant="tonal" class="mb-4">
        <v-alert-title>Unable to Load Billing Data</v-alert-title>
        <div class="mt-1">{{ error }}</div>
        <div class="mt-2 text-body-2">
          This feature requires:
          <ul class="mt-1 ml-4">
            <li>GitHub token with <strong>"Administration" read</strong> permission on the organization</li>
            <li>Organization enrolled in GitHub's enhanced billing platform</li>
          </ul>
        </div>
      </v-alert>
    </div>

    <!-- Main content -->
    <div v-else-if="usageItems.length > 0">
      <!-- KPI Summary tiles -->
      <div class="tiles-container">
        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Total Gross Cost</div>
              <div class="text-caption text-medium-emphasis">Before discounts</div>
              <p class="kpi-value text-primary mt-1">{{ formatCurrency(totalGrossAmount) }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Total Discount</div>
              <div class="text-caption text-medium-emphasis">Credits applied</div>
              <p class="kpi-value text-success mt-1">{{ formatCurrency(totalDiscountAmount) }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Net Cost</div>
              <div class="text-caption text-medium-emphasis">After discounts</div>
              <p class="kpi-value text-warning mt-1">{{ formatCurrency(totalNetAmount) }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Models Used</div>
              <div class="text-caption text-medium-emphasis">Distinct AI models</div>
              <p class="kpi-value text-info mt-1">{{ uniqueModels.length }}</p>
            </div>
          </v-card-item>
        </v-card>
      </div>

      <!-- Cost by model chart + breakdown -->
      <v-row class="mx-2 mb-4">
        <v-col cols="12" md="7">
          <v-card variant="elevated" elevation="2" height="100%">
            <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Net Cost by Model</v-card-title>
            <v-card-text>
              <div style="height: 280px;">
                <canvas ref="modelChartCanvas" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" md="5">
          <v-card variant="elevated" elevation="2" height="100%">
            <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Net Cost by SKU</v-card-title>
            <v-card-text>
              <div style="height: 280px;">
                <canvas ref="skuChartCanvas" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Detailed usage table -->
      <v-card variant="elevated" elevation="2" class="mx-4 mb-4">
        <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Detailed Usage Breakdown</v-card-title>
        <v-card-text class="pa-0">
          <v-data-table
            :headers="tableHeaders"
            :items="usageItems"
            :sort-by="[{ key: 'netAmount', order: 'desc' }]"
            density="compact"
            item-value="model"
          >
            <template #item.grossAmount="{ item }">
              {{ formatCurrency(item.grossAmount) }}
            </template>
            <template #item.discountAmount="{ item }">
              <span class="text-success">-{{ formatCurrency(item.discountAmount) }}</span>
            </template>
            <template #item.netAmount="{ item }">
              <strong>{{ formatCurrency(item.netAmount) }}</strong>
            </template>
            <template #item.pricePerUnit="{ item }">
              {{ formatCurrency(item.pricePerUnit) }}
            </template>
            <template #item.grossQuantity="{ item }">
              {{ item.grossQuantity.toLocaleString() }}
            </template>
            <template #item.netQuantity="{ item }">
              {{ item.netQuantity.toLocaleString() }}
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && !error" class="mx-4">
      <v-alert type="info" variant="tonal">
        No billing data found for the selected period. This could mean no AI credits were consumed,
        or the billing period has not yet been processed.
      </v-alert>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, nextTick, watch } from 'vue';
import type { BillingCreditsResponse, BillingUsageItem } from '#server/api/billing-credits';
import { Options } from '@/model/Options';
import { useRoute } from 'vue-router';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CHART_COLORS = [
  'rgba(99, 102, 241, 0.8)',
  'rgba(34, 197, 94, 0.8)',
  'rgba(251, 146, 60, 0.8)',
  'rgba(59, 130, 246, 0.8)',
  'rgba(239, 68, 68, 0.8)',
  'rgba(168, 85, 247, 0.8)',
  'rgba(20, 184, 166, 0.8)',
  'rgba(234, 179, 8, 0.8)',
];

export default defineComponent({
  name: 'BillingCreditsViewer',
  props: {
    queryParams: {
      type: Object as () => Record<string, string>,
      default: () => ({})
    }
  },
  setup(props) {
    const route = useRoute();
    const loading = ref(false);
    const error = ref<string | null>(null);
    const usageItems = ref<BillingUsageItem[]>([]);
    const timePeriod = ref<{ year?: number; month?: number; day?: number }>({});

    const modelChartCanvas = ref<HTMLCanvasElement | null>(null);
    const skuChartCanvas = ref<HTMLCanvasElement | null>(null);
    let modelChart: Chart | null = null;
    let skuChart: Chart | null = null;

    const now = new Date();
    const selectedYear = ref(now.getFullYear());
    const selectedMonth = ref<number | null>(now.getMonth() + 1);

    const availableYears = computed(() => {
      const currentYear = new Date().getFullYear();
      return Array.from({ length: 3 }, (_, i) => currentYear - i);
    });

    const months = MONTH_LABELS.map((label, i) => ({ label, value: i + 1 }));

    const timePeriodLabel = computed(() => {
      if (!timePeriod.value.year) return '';
      if (timePeriod.value.month) {
        return `${MONTH_LABELS[(timePeriod.value.month ?? 1) - 1]} ${timePeriod.value.year}`;
      }
      return String(timePeriod.value.year);
    });

    const totalGrossAmount = computed(() =>
      usageItems.value.reduce((sum, item) => sum + item.grossAmount, 0)
    );
    const totalDiscountAmount = computed(() =>
      usageItems.value.reduce((sum, item) => sum + item.discountAmount, 0)
    );
    const totalNetAmount = computed(() =>
      usageItems.value.reduce((sum, item) => sum + item.netAmount, 0)
    );
    const uniqueModels = computed(() =>
      [...new Set(usageItems.value.map(i => i.model))]
    );

    function formatCurrency(value: number): string {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
    }

    function buildApiParams(): Record<string, string> {
      const options = Options.fromRoute(route, undefined, undefined);
      const base = { ...props.queryParams, ...options.toParams() };
      if (selectedYear.value) base.year = String(selectedYear.value);
      if (selectedMonth.value) base.month = String(selectedMonth.value);
      return base;
    }

    async function fetchData() {
      loading.value = true;
      error.value = null;
      try {
        const params = buildApiParams();
        const qs = new URLSearchParams(params).toString();
        const url = qs ? `/api/billing-credits?${qs}` : '/api/billing-credits';
        const data = await $fetch<BillingCreditsResponse>(url);
        usageItems.value = data.usageItems || [];
        timePeriod.value = data.timePeriod || {};
        await nextTick();
        renderCharts();
      } catch (err: unknown) {
        const statusCode = err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : null;
        const statusMsg = err && typeof err === 'object' && 'statusMessage' in err
          ? (err as { statusMessage: string }).statusMessage
          : String(err);
        if (statusCode === 403) {
          error.value = `403 Forbidden — your token does not have "Administration" read permission on this organization, which is required for billing data.`;
        } else if (statusCode === 404) {
          error.value = `404 Not Found — billing data is not available for this organization or time period. Ensure your organization is on the enhanced billing platform.`;
        } else if (statusCode === 400) {
          error.value = `400 Bad Request from GitHub — typically this means the organization is not enrolled in the enhanced billing platform, or the token lacks "Administration" read permission. Details: ${statusMsg}`;
        } else {
          error.value = statusMsg || 'Failed to load billing data';
        }
      } finally {
        loading.value = false;
      }
    }

    function renderCharts() {
      destroyCharts();

      const byModel = usageItems.value.reduce<Record<string, number>>((acc, item) => {
        acc[item.model] = (acc[item.model] || 0) + item.netAmount;
        return acc;
      }, {});

      const bySku = usageItems.value.reduce<Record<string, number>>((acc, item) => {
        acc[item.sku] = (acc[item.sku] || 0) + item.netAmount;
        return acc;
      }, {});

      if (modelChartCanvas.value) {
        const labels = Object.keys(byModel).sort((a, b) => byModel[b]! - byModel[a]!);
        modelChart = new Chart(modelChartCanvas.value, {
          type: 'bar',
          data: {
            labels,
            datasets: [{
              label: 'Net Cost ($)',
              data: labels.map(l => byModel[l] || 0),
              backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] || CHART_COLORS[0]!),
              borderWidth: 1,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` $${(ctx.parsed.x as number).toFixed(2)}`
                }
              }
            },
            scales: {
              x: { ticks: { callback: (v) => `$${Number(v).toFixed(2)}` } }
            }
          }
        });
      }

      if (skuChartCanvas.value) {
        const labels = Object.keys(bySku);
        skuChart = new Chart(skuChartCanvas.value, {
          type: 'doughnut',
          data: {
            labels,
            datasets: [{
              data: labels.map(l => bySku[l] || 0),
              backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] || CHART_COLORS[0]!),
              borderWidth: 2,
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { position: 'bottom' },
              tooltip: {
                callbacks: {
                  label: (ctx) => ` ${ctx.label}: $${(ctx.parsed as number).toFixed(2)}`
                }
              }
            }
          }
        });
      }
    }

    function destroyCharts() {
      if (modelChart) { modelChart.destroy(); modelChart = null; }
      if (skuChart) { skuChart.destroy(); skuChart = null; }
    }

    const tableHeaders = [
      { title: 'Product', key: 'product', sortable: true },
      { title: 'SKU', key: 'sku', sortable: true },
      { title: 'Model', key: 'model', sortable: true },
      { title: 'Unit Type', key: 'unitType', sortable: true },
      { title: 'Price / Unit', key: 'pricePerUnit', sortable: true },
      { title: 'Gross Qty', key: 'grossQuantity', sortable: true },
      { title: 'Gross Cost', key: 'grossAmount', sortable: true },
      { title: 'Discount', key: 'discountAmount', sortable: true },
      { title: 'Net Qty', key: 'netQuantity', sortable: true },
      { title: 'Net Cost', key: 'netAmount', sortable: true },
    ];

    watch(() => props.queryParams, () => { fetchData(); }, { deep: true });

    onMounted(() => { fetchData(); });

    return {
      loading,
      error,
      usageItems,
      timePeriodLabel,
      selectedYear,
      selectedMonth,
      availableYears,
      months,
      totalGrossAmount,
      totalDiscountAmount,
      totalNetAmount,
      uniqueModels,
      formatCurrency,
      fetchData,
      tableHeaders,
      modelChartCanvas,
      skuChartCanvas,
    };
  }
});
</script>

<style scoped>
.tiles-container {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  padding: 8px 16px;
  justify-content: flex-start;
}

.tiles-container .v-card {
  flex: 1;
  min-width: 180px;
  max-width: 260px;
}

.tiles-text {
  text-align: center;
  padding: 8px 0;
}

.kpi-value {
  font-size: 1.8rem;
  font-weight: bold;
  margin: 0;
}

.spacing-10 {
  height: 10px;
}
</style>

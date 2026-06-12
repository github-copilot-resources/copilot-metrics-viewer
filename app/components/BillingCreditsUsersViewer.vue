<template>
  <div>
    <!-- Info panel -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-4 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">👤 AI Credit Usage per User</div>
          <div class="text-medium-emphasis">
            Per-user breakdown of AI credit consumption. Fetches billing data for each Copilot seat holder
            and ranks them by net cost. Requires "Administration" read permission on your organization.
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
        <v-alert-title>Unable to Load Per-User Billing Data</v-alert-title>
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
    <div v-else-if="users.length > 0">
      <!-- KPI Summary tiles -->
      <div class="tiles-container">
        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Users Tracked</div>
              <div class="text-caption text-medium-emphasis">Seat holders with usage</div>
              <p class="kpi-value text-primary mt-1">{{ users.length }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Total Net Cost</div>
              <div class="text-caption text-medium-emphasis">All users combined</div>
              <p class="kpi-value text-warning mt-1">{{ formatCurrency(totalNetAmount) }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Avg per User</div>
              <div class="text-caption text-medium-emphasis">Net cost average</div>
              <p class="kpi-value text-info mt-1">{{ formatCurrency(avgNetAmount) }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <div class="text-h6 mb-1">Top Spender</div>
              <div class="text-caption text-medium-emphasis">Highest net cost user</div>
              <p class="kpi-value text-primary mt-1" style="font-size: 1.2rem;">{{ topUser }}</p>
            </div>
          </v-card-item>
        </v-card>
      </div>

      <!-- Bar chart: top users -->
      <v-row class="mx-2 mb-4">
        <v-col cols="12">
          <v-card variant="elevated" elevation="2">
            <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Net Cost by User (Top {{ chartUsers.length }})</v-card-title>
            <v-card-text>
              <div style="height: 320px;">
                <canvas ref="userChartCanvas" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Detailed user table -->
      <v-card variant="elevated" elevation="2" class="mx-4 mb-4">
        <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">User Billing Breakdown</v-card-title>
        <v-card-text class="pa-0">
          <v-data-table
            :headers="tableHeaders"
            :items="users"
            :sort-by="[{ key: 'netAmount', order: 'desc' }]"
            density="compact"
            item-value="login"
          >
            <template #item.login="{ item }">
              <div class="d-flex align-center gap-2 py-1">
                <v-avatar size="24" color="surface-variant">
                  <v-img :src="`https://github.com/${item.login}.png?size=24`" :alt="item.login" />
                </v-avatar>
                <a :href="`https://github.com/${item.login}`" target="_blank" rel="noopener"
                   class="text-decoration-none text-primary">
                  {{ item.login }}
                </a>
              </div>
            </template>
            <template #item.grossAmount="{ item }">
              {{ formatCurrency(item.grossAmount) }}
            </template>
            <template #item.discountAmount="{ item }">
              <span class="text-success">-{{ formatCurrency(item.discountAmount) }}</span>
            </template>
            <template #item.netAmount="{ item }">
              <strong>{{ formatCurrency(item.netAmount) }}</strong>
            </template>
          </v-data-table>
        </v-card-text>
      </v-card>
    </div>

    <!-- Empty state -->
    <div v-else-if="!loading && !error" class="mx-4">
      <v-alert type="info" variant="tonal">
        No per-user billing data found for the selected period. This could mean no AI credits were consumed,
        or the billing period has not yet been processed.
      </v-alert>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, nextTick, watch } from 'vue';
import type { BillingCreditsUsersResponse, UserBillingEntry } from '#server/api/billing-credits-users';
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
  'rgba(236, 72, 153, 0.8)',
  'rgba(14, 165, 233, 0.8)',
];

/** Show at most this many users in the chart to keep it readable. */
const CHART_MAX_USERS = 10;

export default defineComponent({
  name: 'BillingCreditsUsersViewer',
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
    const users = ref<UserBillingEntry[]>([]);
    const timePeriod = ref<{ year?: number; month?: number; day?: number }>({});

    const userChartCanvas = ref<HTMLCanvasElement | null>(null);
    let userChart: Chart | null = null;

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

    const totalNetAmount = computed(() =>
      users.value.reduce((sum, u) => sum + u.netAmount, 0)
    );

    const avgNetAmount = computed(() =>
      users.value.length ? totalNetAmount.value / users.value.length : 0
    );

    const topUser = computed(() =>
      users.value.length ? (users.value[0]?.login ?? '—') : '—'
    );

    const chartUsers = computed(() =>
      [...users.value].sort((a, b) => b.netAmount - a.netAmount).slice(0, CHART_MAX_USERS)
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
        const url = qs ? `/api/billing-credits-users?${qs}` : '/api/billing-credits-users';
        const data = await $fetch<BillingCreditsUsersResponse>(url);
        users.value = data.users || [];
        timePeriod.value = data.timePeriod || {};
        await nextTick();
        renderChart();
      } catch (err: unknown) {
        const statusCode = err && typeof err === 'object' && 'statusCode' in err
          ? (err as { statusCode: number }).statusCode
          : null;
        const statusMsg = err && typeof err === 'object' && 'statusMessage' in err
          ? (err as { statusMessage: string }).statusMessage
          : String(err);
        if (statusCode === 403) {
          error.value = `403 Forbidden — your token does not have "Administration" read permission on this organization, which is required for per-user billing data.`;
        } else if (statusCode === 404) {
          error.value = `404 Not Found — billing data is not available for this organization or time period. Ensure your organization is on the enhanced billing platform.`;
        } else if (statusCode === 400) {
          error.value = `400 Bad Request from GitHub — typically this means the organization is not enrolled in the enhanced billing platform, or the token lacks "Administration" read permission. Details: ${statusMsg}`;
        } else {
          error.value = statusMsg || 'Failed to load per-user billing data';
        }
      } finally {
        loading.value = false;
      }
    }

    function renderChart() {
      if (userChart) { userChart.destroy(); userChart = null; }

      if (!userChartCanvas.value || chartUsers.value.length === 0) return;

      const labels = chartUsers.value.map(u => u.login);
      userChart = new Chart(userChartCanvas.value, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            label: 'Net Cost ($)',
            data: chartUsers.value.map(u => u.netAmount),
            backgroundColor: labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length] || CHART_COLORS[0]),
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

    const tableHeaders = [
      { title: 'User', key: 'login', sortable: true },
      { title: 'Top Model', key: 'topModel', sortable: true },
      { title: 'Gross Cost', key: 'grossAmount', sortable: true },
      { title: 'Discount', key: 'discountAmount', sortable: true },
      { title: 'Net Cost', key: 'netAmount', sortable: true },
    ];

    watch(() => props.queryParams, () => { fetchData(); }, { deep: true });

    onMounted(() => { fetchData(); });

    return {
      loading,
      error,
      users,
      timePeriodLabel,
      selectedYear,
      selectedMonth,
      availableYears,
      months,
      totalNetAmount,
      avgNetAmount,
      topUser,
      chartUsers,
      formatCurrency,
      fetchData,
      tableHeaders,
      userChartCanvas,
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

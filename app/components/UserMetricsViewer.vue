<template>
  <div>
    <!-- Summary tiles -->
    <div class="tiles-container">
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 250px; height: 150px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <div class="text-h6 mb-1">Total Users</div>
            <div class="text-caption">Users with Copilot activity</div>
            <p class="text-h4">{{ totalUsers }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 250px; height: 150px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <div class="text-h6 mb-1">Active Users</div>
            <div class="text-caption">Active in last 7 days of period</div>
            <p class="text-h4">{{ activeUsers }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card v-if="hasPremiumData" elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 250px; height: 150px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <div class="text-h6 mb-1">Premium Requests</div>
            <div class="text-caption">Total premium model requests</div>
            <p class="text-h4">{{ totalPremiumRequests }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 260px; height: 150px;">
        <v-card-item class="d-flex justify-center align-center">
          <div class="tiles-text">
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <div class="text-h6 mb-1">Avg Acceptance Rate</div>
            <div class="text-caption">Code completions accepted</div>
            <p class="text-h4">{{ avgAcceptanceRate }}%</p>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <!-- Search and filter controls -->
    <v-main class="p-1" style="min-height: 300px;">
      <v-container class="px-4 elevation-2">
        <br>
        <h2>Per-User Copilot Usage Metrics</h2>
        <div class="text-caption mb-4">{{ dateRangeDescription }}</div>

        <v-row class="mb-4" align="center">
          <v-col cols="12" md="4">
            <v-text-field
              v-model="search"
              prepend-inner-icon="mdi-magnify"
              label="Search users…"
              placeholder="Search users…"
              single-line
              hide-details
              density="compact"
              variant="outlined"
              clearable
            />
          </v-col>
          <v-col cols="12" md="3">
            <v-select
              v-model="activityFilter"
              :items="activityFilterOptions"
              :menu-props="{ zIndex: 2400 }"
              label="Activity filter"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col v-if="hasPremiumData" cols="12" md="3">
            <v-select
              v-model="premiumFilter"
              :items="premiumFilterOptions"
              :menu-props="{ zIndex: 2400 }"
              label="Premium requests"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
        </v-row>

        <v-data-table
          :headers="tableHeaders"
          :items="filteredUsers"
          :items-per-page="25"
          :items-per-page-options="[10, 25, 50, 100]"
          :search="search"
          class="elevation-1"
          density="comfortable"
        >
          <template #item="{ item }">
            <tr>
              <td>
                <v-chip
                  :color="getActivityColor(item.total_active_days)"
                  size="small"
                  variant="flat"
                >
                  {{ item.login }}
                </v-chip>
              </td>
              <td class="text-center">{{ item.total_active_days }}</td>
              <td class="text-center">{{ item.user_initiated_interaction_count.toLocaleString() }}</td>
              <td class="text-center">{{ item.code_generation_activity_count.toLocaleString() }}</td>
              <td class="text-center">{{ item.code_acceptance_activity_count.toLocaleString() }}</td>
              <td class="text-center">{{ getAcceptanceRate(item) }}%</td>
              <td class="text-center">{{ item.loc_added_sum.toLocaleString() }}</td>
              <td v-if="hasPremiumData" class="text-center">
                <v-chip
                  v-if="(item.premium_requests_total ?? 0) > 0"
                  color="purple"
                  size="small"
                  variant="flat"
                >
                  {{ item.premium_requests_total }}
                </v-chip>
                <span v-else class="text-disabled">0</span>
              </td>
              <td class="text-center">{{ getTopIde(item) }}</td>
              <td class="text-center">{{ getTopLanguage(item) }}</td>
              <td class="text-center">
                <v-btn
                  v-if="showTrendButtons"
                  icon
                  size="x-small"
                  variant="text"
                  :title="`View trend for ${item.login}`"
                  @click="openUserTrend(item.login)"
                >
                  <v-icon>mdi-chart-line</v-icon>
                </v-btn>
              </td>
            </tr>
          </template>
        </v-data-table>
      </v-container>
    </v-main>

    <!-- Per-user trend dialog -->
    <v-dialog v-model="trendDialog" max-width="760">
      <v-card>
        <v-card-title class="d-flex justify-space-between align-center">
          <span>Activity Trend — {{ trendLogin }}</span>
          <v-btn icon variant="text" @click="trendDialog = false"><v-icon>mdi-close</v-icon></v-btn>
        </v-card-title>
        <v-card-text>
          <div v-if="trendLoading" class="d-flex justify-center py-8">
            <v-progress-circular indeterminate color="indigo" />
          </div>
          <v-alert v-else-if="trendError" type="error" density="compact" class="my-4">{{ trendError }}</v-alert>
          <div v-else-if="trendData.length === 0" class="text-center py-8 text-disabled">
            No historical data available for this user yet.
          </div>
          <div v-else>
            <div class="text-caption mb-4">28-day rolling window snapshots stored by the sync job</div>
            <Line :data="trendChartData" :options="trendChartOptions" />
          </div>
        </v-card-text>
      </v-card>
    </v-dialog>

    <!-- User metrics history chart (historical / DB mode only) -->
    <div v-if="userMetricsHistory.length > 0">
      <v-main class="p-1">
        <v-container class="px-4 elevation-2">
          <br>
          <h2>User Metrics History</h2>
          <div class="text-caption mb-4">Trends across stored 28-day snapshots</div>
          <Line :data="historyChartData" :options="historyChartOptions" />
          <br>
          <v-data-table
            :headers="historyHeaders"
            :items="userMetricsHistory"
            :items-per-page="10"
            class="elevation-1 mt-4"
            density="comfortable"
          >
            <template #item="{ item }">
              <tr>
                <td>{{ item.report_end_day }}</td>
                <td class="text-center">{{ item.total_users }}</td>
                <td class="text-center">{{ item.active_users }}</td>
                <td v-if="hasHistoryPremiumData" class="text-center">{{ item.total_premium_requests.toLocaleString() }}</td>
                <td class="text-center">{{ item.avg_acceptance_rate }}%</td>
              </tr>
            </template>
          </v-data-table>
        </v-container>
      </v-main>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, type PropType } from 'vue';
import type { UserTotals } from '../../server/services/github-copilot-usage-api';
import type { UserMetricsHistoryEntry, UserTimeSeriesEntry } from '../../server/storage/user-metrics-storage';
import { Line } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default defineComponent({
  name: 'UserMetricsViewer',
  components: { Line },
  props: {
    userMetrics: {
      type: Array as PropType<UserTotals[]>,
      required: true,
      default: () => []
    },
    dateRangeDescription: {
      type: String,
      default: 'Over the last 28 days'
    },
    /** Time-series snapshots from DB (historical mode). Empty array hides the chart. */
    userMetricsHistory: {
      type: Array as PropType<UserMetricsHistoryEntry[]>,
      default: () => []
    },
    /** Query params forwarded to /api/user-metrics-history?login= (scope, org/ent). */
    queryParams: {
      type: Object as PropType<Record<string, string>>,
      default: () => ({})
    }
  },
  setup(props) {
    const search = ref('');
    const activityFilter = ref('all');
    const premiumFilter = ref('all');

    // ── Per-user trend dialog ──────────────────────────────────────────────
    const trendDialog  = ref(false);
    const trendLogin   = ref('');
    const trendLoading = ref(false);
    const trendError   = ref('');
    const trendData    = ref<UserTimeSeriesEntry[]>([]);

    const showTrendButtons = computed(() => props.userMetricsHistory.length > 0);

    async function openUserTrend(login: string) {
      trendLogin.value   = login;
      trendData.value    = [];
      trendError.value   = '';
      trendLoading.value = true;
      trendDialog.value  = true;

      try {
        const params = new URLSearchParams({ ...props.queryParams, login });
        const data = await $fetch<UserTimeSeriesEntry[]>(`/api/user-metrics-history?${params}`);
        trendData.value = data;
      } catch (err) {
        console.error('Failed to load user trend:', err);
        trendError.value = 'Could not load trend data. Please try again later.';
      } finally {
        trendLoading.value = false;
      }
    }

    const trendChartData = computed(() => {
      const datasets = [
        {
          label: 'Active Days',
          data: trendData.value.map(e => e.total_active_days),
          borderColor: 'rgba(63, 81, 181, 1)',
          backgroundColor: 'rgba(63, 81, 181, 0.15)',
          fill: true,
          tension: 0.3,
          yAxisID: 'yDays',
        },
        {
          label: 'Acceptance Rate %',
          data: trendData.value.map(e => e.acceptance_rate),
          borderColor: 'rgba(76, 175, 80, 1)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: false,
          tension: 0.3,
          yAxisID: 'yRate',
        },
        {
          label: 'Completions',
          data: trendData.value.map(e => e.code_generation_activity_count),
          borderColor: 'rgba(255, 152, 0, 0.9)',
          backgroundColor: 'rgba(255, 152, 0, 0.1)',
          fill: false,
          tension: 0.3,
          yAxisID: 'yCount',
        },
      ];
      if (trendData.value.some(e => e.premium_requests_total > 0)) {
        datasets.push({
          label: 'Premium Req.',
          data: trendData.value.map(e => e.premium_requests_total),
          borderColor: 'rgba(156, 39, 176, 0.9)',
          backgroundColor: 'rgba(156, 39, 176, 0.1)',
          fill: false,
          tension: 0.3,
          yAxisID: 'yCount',
        });
      }
      return { labels: trendData.value.map(e => e.report_end_day), datasets };
    });

    const trendChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      layout: { padding: { top: 10, bottom: 20 } },
      scales: {
        yDays: { type: 'linear' as const, position: 'left'  as const, beginAtZero: true, title: { display: true, text: 'Days / Count' } },
        yRate: { type: 'linear' as const, position: 'right' as const, beginAtZero: true, max: 100, title: { display: true, text: 'Rate %' }, grid: { drawOnChartArea: false } },
        yCount: { display: false },
      },
    };

    const activityFilterOptions = [
      { title: 'All users', value: 'all' },
      { title: 'Active (≥ 7 days)', value: 'active' },
      { title: 'Occasional (1–6 days)', value: 'occasional' },
      { title: 'Inactive (0 days)', value: 'inactive' }
    ];

    const premiumFilterOptions = [
      { title: 'All users', value: 'all' },
      { title: 'Has premium requests', value: 'premium' },
      { title: 'No premium requests', value: 'no-premium' }
    ];

    const totalUsers = computed(() => props.userMetrics.length);

    const activeUsers = computed(() =>
      props.userMetrics.filter(u => u.total_active_days >= 7).length
    );

    const totalPremiumRequests = computed(() =>
      props.userMetrics.reduce((sum, u) => sum + (u.premium_requests_total ?? 0), 0)
    );

    const hasPremiumData = computed(() =>
      props.userMetrics.some(u => u.premium_requests_total !== undefined && u.premium_requests_total !== null)
    );

    const hasHistoryPremiumData = computed(() =>
      props.userMetricsHistory.some(e => e.total_premium_requests > 0)
    );

    const avgAcceptanceRate = computed(() => {
      const totalGenerated = props.userMetrics.reduce((sum, u) => sum + u.code_generation_activity_count, 0);
      const totalAccepted = props.userMetrics.reduce((sum, u) => sum + u.code_acceptance_activity_count, 0);
      if (totalGenerated === 0) return '0.0';
      return ((totalAccepted / totalGenerated) * 100).toFixed(1);
    });

    const filteredUsers = computed(() => {
      let result = [...props.userMetrics];

      if (activityFilter.value === 'active') {
        result = result.filter(u => u.total_active_days >= 7);
      } else if (activityFilter.value === 'occasional') {
        result = result.filter(u => u.total_active_days >= 1 && u.total_active_days < 7);
      } else if (activityFilter.value === 'inactive') {
        result = result.filter(u => u.total_active_days === 0);
      }

      if (premiumFilter.value === 'premium') {
        result = result.filter(u => (u.premium_requests_total ?? 0) > 0);
      } else if (premiumFilter.value === 'no-premium') {
        result = result.filter(u => (u.premium_requests_total ?? 0) === 0);
      }

      return result;
    });

    function getAcceptanceRate(user: UserTotals): string {
      if (user.code_generation_activity_count === 0) return '0.0';
      return ((user.code_acceptance_activity_count / user.code_generation_activity_count) * 100).toFixed(1);
    }

    function getActivityColor(activeDays: number): string {
      if (activeDays >= 14) return 'success';
      if (activeDays >= 7) return 'info';
      if (activeDays >= 1) return 'warning';
      return 'error';
    }

    function getTopIde(user: UserTotals): string {
      if (!user.totals_by_ide || user.totals_by_ide.length === 0) return '—';
      const top = user.totals_by_ide.reduce((a, b) =>
        (a.user_initiated_interaction_count + a.code_generation_activity_count) >=
        (b.user_initiated_interaction_count + b.code_generation_activity_count) ? a : b
      );
      return top.ide;
    }

    function getTopLanguage(user: UserTotals): string {
      if (!user.totals_by_language_feature || user.totals_by_language_feature.length === 0) return '—';
      const langMap = new Map<string, number>();
      for (const entry of user.totals_by_language_feature) {
        langMap.set(entry.language, (langMap.get(entry.language) ?? 0) + entry.code_generation_activity_count);
      }
      let topLang = '—';
      let topCount = 0;
      for (const [lang, count] of langMap) {
        if (count > topCount) {
          topCount = count;
          topLang = lang;
        }
      }
      return topLang;
    }

    const tableHeaders = computed(() => {
      const cols: { title: string; key: string; sortable?: boolean }[] = [
        { title: 'User',           key: 'login',                            sortable: true  },
        { title: 'Active Days',    key: 'total_active_days',                sortable: true  },
        { title: 'Interactions',   key: 'user_initiated_interaction_count', sortable: true  },
        { title: 'Completions',    key: 'code_generation_activity_count',   sortable: true  },
        { title: 'Accepted',       key: 'code_acceptance_activity_count',   sortable: true  },
        { title: 'Accept Rate',    key: 'acceptance_rate',                  sortable: false },
        { title: 'Lines Accepted', key: 'loc_added_sum',                    sortable: true  },
      ];
      if (hasPremiumData.value) {
        cols.push({ title: 'Premium Req.', key: 'premium_requests_total', sortable: true });
      }
      cols.push(
        { title: 'Top IDE',        key: 'top_ide',                          sortable: false },
        { title: 'Top Language',   key: 'top_language',                     sortable: false },
      );
      if (showTrendButtons.value) {
        cols.push({ title: 'Trend', key: 'trend', sortable: false });
      }
      return cols;
    });

    // ── History chart ───────────────────────────────────────────────────────
    const historyChartData = computed(() => {
      const datasets = [
        {
          label: 'Total Users',
          data: props.userMetricsHistory.map(e => e.total_users),
          borderColor: 'rgba(63, 81, 181, 1)',
          backgroundColor: 'rgba(63, 81, 181, 0.15)',
          fill: true,
          tension: 0.3,
          yAxisID: 'yUsers',
        },
        {
          label: 'Active Users (≥7 days)',
          data: props.userMetricsHistory.map(e => e.active_users),
          borderColor: 'rgba(76, 175, 80, 1)',
          backgroundColor: 'rgba(76, 175, 80, 0.1)',
          fill: false,
          tension: 0.3,
          yAxisID: 'yUsers',
        },
      ];
      if (hasHistoryPremiumData.value) {
        datasets.push({
          label: 'Premium Requests',
          data: props.userMetricsHistory.map(e => e.total_premium_requests),
          borderColor: 'rgba(156, 39, 176, 0.9)',
          backgroundColor: 'rgba(156, 39, 176, 0.1)',
          fill: false,
          tension: 0.3,
          yAxisID: 'yPremium',
        });
      }
      return { labels: props.userMetricsHistory.map(e => e.report_end_day), datasets };
    });

    const historyChartOptions = computed(() => {
      const scales: Record<string, object> = {
        yUsers: { type: 'linear' as const, position: 'left' as const, beginAtZero: true, title: { display: true, text: 'Users' } },
      };
      if (hasHistoryPremiumData.value) {
        scales.yPremium = { type: 'linear' as const, position: 'right' as const, beginAtZero: true, title: { display: true, text: 'Premium Req.' }, grid: { drawOnChartArea: false } };
      }
      return {
        responsive: true,
        maintainAspectRatio: true,
        layout: { padding: { left: 60, right: 60, top: 20, bottom: 40 } },
        scales,
      };
    });

    const historyHeaders = computed(() => {
      const cols = [
        { title: 'Snapshot (end day)', key: 'report_end_day' },
        { title: 'Total Users',        key: 'total_users' },
        { title: 'Active Users',       key: 'active_users' },
      ];
      if (hasHistoryPremiumData.value) {
        cols.push({ title: 'Premium Requests', key: 'total_premium_requests' });
      }
      cols.push({ title: 'Avg Acceptance', key: 'avg_acceptance_rate' });
      return cols;
    });

    return {
      search,
      activityFilter,
      premiumFilter,
      activityFilterOptions,
      premiumFilterOptions,
      totalUsers,
      activeUsers,
      totalPremiumRequests,
      hasPremiumData,
      hasHistoryPremiumData,
      avgAcceptanceRate,
      filteredUsers,
      tableHeaders,
      getAcceptanceRate,
      getActivityColor,
      getTopIde,
      getTopLanguage,
      historyChartData,
      historyChartOptions,
      historyHeaders,
      // trend dialog
      showTrendButtons,
      trendDialog,
      trendLogin,
      trendLoading,
      trendError,
      trendData,
      trendChartData,
      trendChartOptions,
      openUserTrend,
    };
  }
});
</script>

<style scoped>
.tiles-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16px;
  padding: 16px;
}

.tiles-text {
  text-align: center;
}
</style>

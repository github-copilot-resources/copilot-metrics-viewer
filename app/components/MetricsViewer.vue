<template>
  <div>
    <!-- Dashboard info panel -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-1 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">📊 Organization Dashboard</div>
          <div class="text-medium-emphasis">
            Copilot activity metrics for the current month. Tracks how developers use Copilot — from AI chat and agent mode to IDE code completions. Acceptance rates reflect <em>inline completions only</em>; CLI, agents, and github.com interactions won't appear there.
          </div>
        </div>
        <v-divider vertical class="mx-2 hidden-sm-and-down" />
        <div class="d-flex flex-column gap-1">
          <div class="text-caption text-medium-emphasis font-weight-medium mb-1">LEARN MORE</div>
          <a href="https://docs.github.com/en/copilot/reference/copilot-usage-metrics" target="_blank" rel="noopener" class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">How metrics are calculated</span>
          </a>
          <a href="https://docs.github.com/en/copilot/reference/interpret-copilot-metrics" target="_blank" rel="noopener" class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">How to interpret this dashboard</span>
          </a>
          <a href="https://resources.github.com/engineering-system-success-playbook/" target="_blank" rel="noopener" class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Engineering System Success Playbook</span>
          </a>
        </div>
      </div>
    </v-card>

    <!-- KPI Row 1: Adoption metrics (from reportData) -->
    <div v-if="ideActiveUsers > 0" class="tiles-container">
      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">IDE active users</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Copilot-licensed users who interacted with Copilot in the current calendar month (via IDE chat or code completions).</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">Current calendar month</div>
            <p class="kpi-value text-primary">{{ ideActiveUsers }}</p>
            <v-chip v-if="trendActiveUsers" size="x-small" :color="trendActiveUsers.color" variant="tonal" class="mt-1">
              <v-icon start size="x-small">{{ trendActiveUsers.icon }}</v-icon>{{ trendActiveUsers.label }}
            </v-chip>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Agent adoption</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Active users who used any agent feature (agent mode, edit mode) in the current calendar month.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">{{ agentAdoptionNum }} out of {{ ideActiveUsers }} active users</div>
            <p class="kpi-value text-success">{{ agentAdoptionPct }}%</p>
            <v-progress-linear :model-value="agentAdoptionPct" color="success" bg-color="#C8E6C9" rounded height="6" class="mt-2 mx-2" />
            <v-chip v-if="trendAdoptionPct" size="x-small" :color="trendAdoptionPct.color" variant="tonal" class="mt-1">
              <v-icon start size="x-small">{{ trendAdoptionPct.icon }}</v-icon>{{ trendAdoptionPct.label }}
            </v-chip>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Most used chat model</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Model with the highest number of user-initiated chat requests in the last 28 days (across all chat modes, excluding code completions).</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">Last 28 days</div>
            <p class="kpi-value mt-2 text-primary" style="word-break: break-word;">{{ mostUsedChatModel || '—' }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Top Copilot feature</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Copilot feature (Agent, Ask, Edit, CLI, etc.) with the most user-initiated interactions in the last 28 days, excluding IDE code completions.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">Last 28 days</div>
            <p class="kpi-value mt-2 text-primary" style="word-break: break-word;">{{ mostUsedChatMode || '—' }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Total chat requests</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Total user-initiated chat interactions across all modes (Agent, Ask, Edit, Inline, etc.) in the last 28 days. Excludes IDE code completions.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">Last 28 days</div>
            <p class="kpi-value mt-2 text-primary">{{ formatCompact(totalChatRequests) }}</p>
            <v-chip v-if="trendChatRequests" size="x-small" :color="trendChatRequests.color" variant="tonal" class="mt-1">
              <v-icon start size="x-small">{{ trendChatRequests.icon }}</v-icon>{{ trendChatRequests.label }}
            </v-chip>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <!-- KPI Row 2: IDE inline completion details (de-emphasized) -->
    <div class="tiles-container mt-0" style="margin-top: 0 !important;">
      <v-card elevation="1" color="surface-variant" variant="elevated" class="my-1">
        <v-card-item>
          <div class="tiles-text">
            <div class="text-caption text-medium-emphasis mt-1">IDE Completion Acceptance Rate (count)</div>
            <p class="kpi-value-sm mt-1">{{ acceptanceRateAverageByCount.toFixed(1) }}%</p>
            <v-chip v-if="trendAcceptanceCount" size="x-small" :color="trendAcceptanceCount.color" variant="tonal" class="mt-1">
              <v-icon start size="x-small">{{ trendAcceptanceCount.icon }}</v-icon>{{ trendAcceptanceCount.label }}
            </v-chip>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="1" color="surface-variant" variant="elevated" class="my-1">
        <v-card-item>
          <div class="tiles-text">
            <div class="text-caption text-medium-emphasis mt-1">IDE Completion Acceptance Rate (lines)</div>
            <p class="kpi-value-sm mt-1">{{ acceptanceRateAverageByLines.toFixed(1) }}%</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="1" color="surface-variant" variant="elevated" class="my-1">
        <v-card-item>
          <div class="tiles-text">
            <div class="text-caption text-medium-emphasis mt-1">Total IDE Code Completions</div>
            <p class="kpi-value-sm mt-1">{{ cumulativeNumberSuggestions.toLocaleString() }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="1" color="surface-variant" variant="elevated" class="my-1">
        <v-card-item>
          <div class="tiles-text">
            <div class="text-caption text-medium-emphasis mt-1">Total Lines Suggested (IDE completions)</div>
            <p class="kpi-value-sm mt-1">{{ totalLinesSuggested.toLocaleString() }}</p>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">
      <v-container style="min-height: 300px;" :fluid="chartColumns === 'full'" :class="['elevation-2', chartColumns === 'full' ? 'px-0' : 'px-4']">

        <!-- Chart layout toggle -->
        <div class="d-flex justify-end mb-2">
          <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
            <v-btn value="1" size="small" icon="mdi-view-agenda" title="Single column" />
            <v-btn value="2" size="small" icon="mdi-view-grid" title="Two columns" />
            <v-btn value="full" size="small" icon="mdi-fullscreen" title="Full width" />
          </v-btn-toggle>
        </div>

        <v-row>
          <!-- ── Active Users ───────────────────────────────── -->
          <v-col v-if="ideDauChartData.labels.length" cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">IDE daily active users</div>
              <div class="text-caption text-medium-emphasis mb-2">Unique users who used Copilot on a given day, either via chat or code completions · <span class="font-italic">Shaded columns = weekends</span></div>
              <div style="height:220px"><Line :data="ideDauChartData" :options="dauWauOptions ?? integerYOptions" :plugins="[gradientFillPlugin, weekendPlugin]" /></div>
            </v-card>
          </v-col>

          <v-col v-if="ideWauChartData.labels.length" cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">IDE weekly active users</div>
              <div class="text-caption text-medium-emphasis mb-2">Unique users who used Copilot in a given week, either via chat or code completions · <span class="font-italic">Shaded columns = weekends</span></div>
              <div style="height:220px"><Line :data="ideWauChartData" :options="dauWauOptions ?? integerYOptions" :plugins="[gradientFillPlugin, weekendPlugin]" /></div>
            </v-card>
          </v-col>

          <!-- ── Active Users Over Time ──────────────────────────────── -->
          <v-col v-if="activeUsersOverTimeChartData.labels.length" cols="12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">Active Users Over Time</div>
              <div class="text-caption text-medium-emphasis mb-2">
                <strong>Monthly active users</strong> = anyone who used any Copilot feature at least once in the past 28 days (IDE completions, chat, agent mode, CLI, PR summaries).
                Daily and weekly counts use shorter rolling windows. · <span class="font-italic">Shaded columns = weekends</span>
              </div>
              <div style="height:220px"><Line :data="activeUsersOverTimeChartData" :options="integerYOptions" :plugins="[gradientFillPlugin, weekendPlugin]" /></div>
            </v-card>
          </v-col>

          <!-- ── Feature Usage Over Time ───────────────────────────────── -->
          <v-col v-if="featureUsageOverTimeChartData.labels.length" cols="12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">Feature Usage Over Time</div>
              <div class="text-caption text-medium-emphasis mb-2">User-initiated interactions per feature per day — covers all Copilot features: IDE chat, agent mode, edit mode, inline chat, CLI, PR summaries, and more · <span class="font-italic">Shaded columns = weekends</span></div>
              <div style="height:240px"><Line :data="featureUsageOverTimeChartData" :options="compactChartOptions" :plugins="[gradientFillPlugin, weekendPlugin]" /></div>
            </v-card>
          </v-col>

          <!-- ── Feature Activity Breakdown ────────────────────────────── -->
          <v-col v-if="featureActivityChartData.labels.length" cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">Feature Activity Breakdown</div>
              <div class="text-caption text-medium-emphasis mb-2">Total user-initiated interactions per feature across the entire date range (top 10)</div>
              <div style="height:240px"><Bar :data="featureActivityChartData" :options="groupedBarOptions" /></div>
            </v-card>
          </v-col>

          <!-- ── Chat ───────────────────────────────────────── -->
          <v-col v-if="avgChatReqChartData.labels.length" cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">Average chat requests per active user</div>
              <div class="text-caption text-medium-emphasis mb-2">User-initiated requests across all chat modes, excluding code completions · <span class="font-italic">Shaded columns = weekends</span></div>
              <div style="height:220px"><Line :data="avgChatReqChartData" :options="compactChartOptions" :plugins="[gradientFillPlugin, weekendPlugin]" /></div>
            </v-card>
          </v-col>

          <v-col v-if="requestsPerModeChartData.labels.length" cols="12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">Requests per chat mode</div>
              <div class="text-caption text-medium-emphasis mb-2">User-initiated chat requests across all modes · <span class="font-italic">Shaded columns = weekends</span></div>
              <div style="height:220px"><Bar :data="requestsPerModeChartData" :options="stackedBarOptions" :plugins="[weekendPlugin]" /></div>
            </v-card>
          </v-col>

          <!-- ── Code Completions ────────────────────────────── -->
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">Code completions</div>
              <div class="text-caption text-medium-emphasis mb-2">Inline code suggestions shown and accepted · <span class="font-italic">Shaded columns = weekends</span></div>
              <div style="height:220px"><Line :data="totalSuggestionsAndAcceptanceChartData" :options="compactChartOptions" :plugins="[gradientFillPlugin, weekendPlugin]" /></div>
            </v-card>
          </v-col>

          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
            <v-card variant="outlined" class="pa-3 flex-grow-1">
              <div class="text-subtitle-1 font-weight-bold">Code completions acceptance rate</div>
              <div class="text-caption text-medium-emphasis mb-2">Percentage of shown inline completions that were accepted · <span class="font-italic">Shaded columns = weekends</span></div>
              <div style="height:220px"><Bar :data="acceptanceRateByCountChartData" :options="compactChartOptions" :plugins="[weekendPlugin]" /></div>
            </v-card>
          </v-col>

        </v-row>

      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watchEffect } from 'vue';
import type { Metrics } from '@/model/Metrics';
import type { ReportDayTotals } from '@/server/services/github-copilot-usage-api';
import { weekendPlugin, gradientFillPlugin, PALETTE, formatCompact as fmtCompact } from '@/utils/chartPlugins';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'

import { Line, Bar } from 'vue-chartjs'

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

// System font + slightly larger tick labels to match GitHub dashboard
ChartJS.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif';
ChartJS.defaults.font.size = 12;
ChartJS.defaults.plugins.legend.labels.font = { size: 12 } as any;

function formatCompact(n: number): string { return fmtCompact(n); }

const FEATURE_DISPLAY: Record<string, string> = {
  code_completion: 'Completions',
  copilot_cli: 'CLI',
  agent_edit: 'Edit',
  chat_panel_ask_mode: 'Ask',
  chat_panel_agent_mode: 'Agent',
  chat_panel_custom_mode: 'Custom',
  chat_panel_edit_mode: 'Edit',
  chat_panel_plan_mode: 'Plan',
  chat_inline: 'Inline',
  plan_mode: 'Plan',
};

function featureLabel(key: string) {
  return FEATURE_DISPLAY[key] ?? key;
}


export default defineComponent({
  name: 'MetricsViewer',
  components: { Line, Bar },
  props: {
    metrics: {
      type: Array as PropType<Metrics[]>,
      required: true
    },
    reportData: {
      type: Array as PropType<ReportDayTotals[]>,
      default: () => []
    },
    dateRangeDescription: {
      type: String,
      default: 'Over the last 28 days'
    }
  },
  setup(props) {
    // ── Completion KPI tiles ──────────────────────────────────────────────
    const acceptanceRateAverageByLines = ref(0);
    const acceptanceRateAverageByCount = ref(0);
    const cumulativeNumberSuggestions = ref(0);
    const cumulativeNumberAcceptances = ref(0);
    const cumulativeNumberLOCAccepted = ref(0);
    const totalLinesSuggested = ref(0);

    // ── Adoption KPI tiles (from reportData) ─────────────────────────────
    const ideActiveUsers = ref(0);
    const agentAdoptionPct = ref(0);
    const agentAdoptionNum = ref(0);
    const mostUsedChatModel = ref('');
    const mostUsedChatMode = ref('');
    const totalChatRequests = ref(0);

    // ── Legacy completion charts ──────────────────────────────────────────
    const acceptanceRateByCountChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const totalSuggestionsAndAcceptanceChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    // ── Trend arrows for KPI tiles ────────────────────────────────────────
    interface TrendInfo { icon: string; color: string; label: string }
    const trendActiveUsers  = ref<TrendInfo | null>(null);
    const trendAdoptionPct  = ref<TrendInfo | null>(null);
    const trendChatRequests = ref<TrendInfo | null>(null);
    const trendAcceptanceCount = ref<TrendInfo | null>(null);

    function computeTrend(prev: number, curr: number): TrendInfo | null {
      if (prev === 0) return null;
      const pct = Math.round((curr - prev) / prev * 100);
      if (Math.abs(pct) < 1) return { icon: 'mdi-trending-neutral', color: 'grey', label: '~0%' };
      if (pct > 0) return { icon: 'mdi-trending-up', color: 'success', label: `+${pct}%` };
      return { icon: 'mdi-trending-down', color: 'error', label: `${pct}%` };
    }

    // ── New charts from reportData ────────────────────────────────────────
    const ideDauChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const ideWauChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const dauWauOptions = ref<any>(null); // shared y-axis scale for DAU + WAU
    const activeUsersOverTimeChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const featureUsageOverTimeChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const featureActivityChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const avgChatReqChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const requestsPerModeChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    // Language charts moved to BreakdownComponent (Languages tab)
    // ── Chart options ─────────────────────────────────────────────────────
    const xTicks = { ticks: { maxTicksLimit: 14 } };

    const compactChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      scales: { x: xTicks, y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' as const } },
    };

    const integerYOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      scales: { x: xTicks, y: { beginAtZero: true, ticks: { stepSize: 1, precision: 0 }, title: { display: true, text: 'Users' } } },
      plugins: { legend: { position: 'bottom' as const } },
    };

    const stackedBarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { stacked: true, ...xTicks }, y: { stacked: true, beginAtZero: true } },
      plugins: { legend: { position: 'bottom' as const } },
    };

    const groupedBarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: xTicks, y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' as const } },
    };

    // ── Watch metrics (legacy) ────────────────────────────────────────────
    watchEffect(() => {
      const data = toRef(props, 'metrics').value;
      if (!data || data.length === 0) return;

      cumulativeNumberSuggestions.value = 0;
      const cumulativeSuggestionsData = data.map((m: Metrics) => {
        cumulativeNumberSuggestions.value += m.total_suggestions_count;
        return m.total_suggestions_count;
      });

      cumulativeNumberAcceptances.value = 0;
      const cumulativeAcceptancesData = data.map((m: Metrics) => {
        cumulativeNumberAcceptances.value += m.total_acceptances_count;
        return m.total_acceptances_count;
      });

      totalSuggestionsAndAcceptanceChartData.value = {
        labels: data.map((m: Metrics) => m.day),
        datasets: [
          { label: 'Total Code Completions', data: cumulativeSuggestionsData, backgroundColor: 'rgba(75, 192, 192, 0.2)', borderColor: 'rgba(75, 192, 192, 1)' },
          { label: 'Total Accepted', data: cumulativeAcceptancesData, backgroundColor: 'rgba(153, 102, 255, 0.2)', borderColor: 'rgba(153, 102, 255, 1)' },
        ]
      };

      cumulativeNumberLOCAccepted.value = 0;
      data.forEach((m: Metrics) => {
        cumulativeNumberLOCAccepted.value += m.total_lines_accepted;
      });

      const acceptanceRatesByCount = data.map((m: Metrics) =>
        m.total_suggestions_count !== 0 ? (m.total_acceptances_count / m.total_suggestions_count) * 100 : 0
      );

      acceptanceRateByCountChartData.value = {
        labels: data.map((m: Metrics) => m.day),
        datasets: [{
          type: 'line',
          label: 'Acceptance Rate by Count',
          data: acceptanceRatesByCount,
          backgroundColor: 'rgba(173, 216, 230, 0.2)',
          borderColor: 'rgba(173, 216, 230, 1)',
          fill: false
        }]
      };

      totalLinesSuggested.value = data.reduce((sum: number, m: Metrics) => sum + m.total_lines_suggested, 0);
      acceptanceRateAverageByLines.value = totalLinesSuggested.value === 0 ? 0
        : cumulativeNumberLOCAccepted.value / totalLinesSuggested.value * 100;
      acceptanceRateAverageByCount.value = cumulativeNumberSuggestions.value === 0 ? 0
        : cumulativeNumberAcceptances.value / cumulativeNumberSuggestions.value * 100;

      // Acceptance rate trend: first half avg vs second half avg
      if (acceptanceRatesByCount.length >= 2) {
        const mid = Math.floor(acceptanceRatesByCount.length / 2);
        const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length;
        trendAcceptanceCount.value = computeTrend(avg(acceptanceRatesByCount.slice(0, mid)), avg(acceptanceRatesByCount.slice(mid)));
      }
    });

    // ── Watch reportData (new charts) ─────────────────────────────────────
    watchEffect(() => {
      const data = toRef(props, 'reportData').value;
      if (!data || data.length === 0) return;

      // ── KPI: adoption ─────────────────────────────────────────────────
      const latest = data[data.length - 1];
      ideActiveUsers.value = latest.monthly_active_users ?? 0;
      agentAdoptionNum.value = latest.monthly_active_agent_users ?? 0;
      agentAdoptionPct.value = ideActiveUsers.value > 0
        ? Math.round(agentAdoptionNum.value / ideActiveUsers.value * 100)
        : 0;

      // Most used chat model = max user_initiated_interaction_count across all days, non-completions
      const modelTotals: Record<string, number> = {};
      for (const day of data) {
        for (const mf of (day.totals_by_model_feature ?? [])) {
          if (mf.feature === 'code_completion') continue;
          const key = mf.model ?? 'Unknown';
          modelTotals[key] = (modelTotals[key] ?? 0) + (mf.user_initiated_interaction_count ?? 0);
        }
      }
      const topModel = Object.entries(modelTotals).sort((a, b) => b[1] - a[1])[0];
      mostUsedChatModel.value = topModel ? topModel[0] : '';

      // Most used chat mode + total chat requests
      const featureTotals: Record<string, number> = {};
      let chatTotal = 0;
      for (const day of data) {
        for (const f of (day.totals_by_feature ?? [])) {
          if (f.feature === 'code_completion') continue;
          const cnt = f.user_initiated_interaction_count ?? 0;
          featureTotals[f.feature ?? ''] = (featureTotals[f.feature ?? ''] ?? 0) + cnt;
          chatTotal += cnt;
        }
      }
      const topFeature = Object.entries(featureTotals).sort((a, b) => b[1] - a[1])[0];
      mostUsedChatMode.value = topFeature ? featureLabel(topFeature[0]) : '';
      totalChatRequests.value = chatTotal;

      // ── Trend computation (first half vs second half) ──────────────────
      if (data.length >= 2) {
        const mid = Math.floor(data.length / 2);
        const first = data.slice(0, mid);
        const second = data.slice(mid);

        // Active users: last value of each half
        const prevActive = first[first.length - 1]?.monthly_active_users ?? 0;
        const currActive = second[second.length - 1]?.monthly_active_users ?? 0;
        trendActiveUsers.value = computeTrend(prevActive, currActive);

        // Agent adoption %: last value of each half
        const prevMau = first[first.length - 1]?.monthly_active_users ?? 0;
        const prevAgentMau = first[first.length - 1]?.monthly_active_agent_users ?? 0;
        const currMau = second[second.length - 1]?.monthly_active_users ?? 0;
        const currAgentMau = second[second.length - 1]?.monthly_active_agent_users ?? 0;
        const prevAdopt = prevMau > 0 ? prevAgentMau / prevMau * 100 : 0;
        const currAdopt = currMau > 0 ? currAgentMau / currMau * 100 : 0;
        trendAdoptionPct.value = computeTrend(prevAdopt, currAdopt);

        // Total chat requests: sum over each half
        const sumRequests = (half: typeof data) => half.reduce((s, d) =>
          s + (d.totals_by_feature ?? []).filter(f => f.feature !== 'code_completion')
            .reduce((fs, f) => fs + (f.user_initiated_interaction_count ?? 0), 0), 0);
        trendChatRequests.value = computeTrend(sumRequests(first), sumRequests(second));

        // Acceptance rate (count): average over each half (from legacy metrics if available)
        trendAcceptanceCount.value = null; // computed separately in legacy watchEffect
      } else {
        trendActiveUsers.value = null;
        trendAdoptionPct.value = null;
        trendChatRequests.value = null;
      }

      const labels = data.map(d => d.day ?? '');

      // ── DAU / WAU ─────────────────────────────────────────────────────
      ideDauChartData.value = {
        labels,
        datasets: [{
          label: 'Daily active users',
          data: data.map(d => d.daily_active_users ?? 0),
          backgroundColor: 'rgba(54, 162, 235, 0.3)',
          borderColor: 'rgb(54, 162, 235)',
          fill: true,
          tension: 0.3,
        }]
      };

      ideWauChartData.value = {
        labels,
        datasets: [{
          label: 'Weekly active users',
          data: data.map(d => d.weekly_active_users ?? 0),
          backgroundColor: 'rgba(75, 192, 192, 0.3)',
          borderColor: 'rgb(75, 192, 192)',
          fill: true,
          tension: 0.3,
        }]
      };

      // Shared y-axis scale so DAU and WAU charts are directly comparable
      const dauVals = data.map(d => d.daily_active_users ?? 0);
      const wauVals = data.map(d => d.weekly_active_users ?? 0);
      const yMax = Math.max(...dauVals, ...wauVals, 1);
      dauWauOptions.value = {
        ...integerYOptions,
        scales: { ...integerYOptions.scales, y: { ...integerYOptions.scales.y, suggestedMax: yMax } },
      };

      // ── Active Users Over Time (3 lines: daily / weekly / monthly) ────
      activeUsersOverTimeChartData.value = {
        labels,
        datasets: [
          {
            label: 'Daily active users',
            data: data.map(d => d.daily_active_users ?? 0),
            borderColor: 'rgb(54, 162, 235)', backgroundColor: 'rgba(54, 162, 235, 0.15)',
            fill: false, tension: 0.3,
          },
          {
            label: 'Weekly active users',
            data: data.map(d => d.weekly_active_users ?? 0),
            borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.15)',
            fill: false, tension: 0.3,
          },
          {
            label: 'Monthly active users',
            data: data.map(d => d.monthly_active_users ?? 0),
            borderColor: 'rgb(153, 102, 255)', backgroundColor: 'rgba(153, 102, 255, 0.15)',
            fill: false, tension: 0.3,
          },
        ]
      };

      // ── Feature Usage Over Time (all features, line chart) ────────────
      const allFeatureKeys = [...new Set(
        data.flatMap(d => (d.totals_by_feature ?? [])
          .filter(f => (f.user_initiated_interaction_count ?? 0) > 0)
          .map(f => f.feature ?? ''))
      )];
      featureUsageOverTimeChartData.value = {
        labels,
        datasets: allFeatureKeys.map((fk, i) => ({
          label: featureLabel(fk),
          data: data.map(d => (d.totals_by_feature ?? []).find(f => f.feature === fk)?.user_initiated_interaction_count ?? 0),
          borderColor: PALETTE[i % PALETTE.length].border,
          backgroundColor: PALETTE[i % PALETTE.length].bg,
          fill: false, tension: 0.3,
        }))
      };

      // ── Feature activity breakdown (aggregated totals bar chart) ──────
      const featureTotalMap = new Map<string, number>();
      for (const d of data) {
        for (const f of (d.totals_by_feature ?? [])) {
          const cnt = f.user_initiated_interaction_count ?? 0;
          if (cnt > 0) featureTotalMap.set(f.feature ?? '', (featureTotalMap.get(f.feature ?? '') ?? 0) + cnt);
        }
      }
      const topFeatures = [...featureTotalMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
      featureActivityChartData.value = {
        labels: topFeatures.map(([fk]) => featureLabel(fk)),
        datasets: [{
          label: 'Total interactions',
          data: topFeatures.map(([, v]) => v),
          backgroundColor: topFeatures.map((_, i) => PALETTE[i % PALETTE.length].bg),
          borderColor: topFeatures.map((_, i) => PALETTE[i % PALETTE.length].border),
          borderWidth: 1,
        }]
      };

      // ── Avg chat requests per user ────────────────────────────────────
      avgChatReqChartData.value = {
        labels,
        datasets: [{
          label: 'Avg chat requests per user',
          data: data.map(d => {
            const dau = d.daily_active_users ?? 0;
            if (dau === 0) return 0;
            const total = (d.totals_by_feature ?? [])
              .filter(f => f.feature !== 'code_completion')
              .reduce((s, f) => s + (f.user_initiated_interaction_count ?? 0), 0);
            return parseFloat((total / dau).toFixed(2));
          }),
          backgroundColor: 'rgba(153, 102, 255, 0.3)',
          borderColor: 'rgb(153, 102, 255)',
          fill: true,
          tension: 0.3,
        }]
      };

      // ── Requests per chat mode (stacked bar) ─────────────────────────
      const featureKeys = [...new Set(
        data.flatMap(d => (d.totals_by_feature ?? [])
          .filter(f => f.feature !== 'code_completion' && (f.user_initiated_interaction_count ?? 0) > 0)
          .map(f => f.feature ?? ''))
      )];
      requestsPerModeChartData.value = {
        labels,
        datasets: featureKeys.map((fk, i) => ({
          label: featureLabel(fk),
          data: data.map(d => (d.totals_by_feature ?? []).find(f => f.feature === fk)?.user_initiated_interaction_count ?? 0),
          backgroundColor: PALETTE[i % PALETTE.length].bg,
          borderColor: PALETTE[i % PALETTE.length].border,
          stack: 'modes',
        }))
      };

    });

    return {
      // KPI tiles
      ideActiveUsers, agentAdoptionPct, agentAdoptionNum, mostUsedChatModel,
      mostUsedChatMode, totalChatRequests, formatCompact,
      acceptanceRateAverageByLines, acceptanceRateAverageByCount,
      cumulativeNumberSuggestions, cumulativeNumberAcceptances,
      cumulativeNumberLOCAccepted, totalLinesSuggested,
      // Trend arrows
      trendActiveUsers, trendAdoptionPct, trendChatRequests, trendAcceptanceCount,
      // Chart options
      compactChartOptions, integerYOptions, dauWauOptions, stackedBarOptions, groupedBarOptions,
      // Weekend plugin
      weekendPlugin,
      gradientFillPlugin,
      // Charts
      acceptanceRateByCountChartData, totalSuggestionsAndAcceptanceChartData,
      ideDauChartData, ideWauChartData, avgChatReqChartData, requestsPerModeChartData,
      activeUsersOverTimeChartData, featureUsageOverTimeChartData, featureActivityChartData,
    };
  },
  data() {
    return { chartColumns: '2' };
  },
});
</script>

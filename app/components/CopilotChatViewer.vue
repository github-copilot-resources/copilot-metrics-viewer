<template>
  <div>
    <!-- Info panel — same style as Organization tab -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-4 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">💬 Copilot Chat</div>
          <div class="text-medium-emphasis">
            Daily chat interactions (user prompts sent to Copilot) and code actions (applying,
            inserting, or copying AI responses). Does <em>not</em> include CLI or agent-initiated
            edits — see the Agent Activity tab for those.
          </div>
        </div>
        <v-divider vertical class="mx-2 hidden-sm-and-down" />
        <div class="d-flex flex-column gap-1">
          <div class="text-caption text-medium-emphasis font-weight-medium mb-1">LEARN MORE</div>
          <a href="https://docs.github.com/en/copilot/reference/copilot-usage-metrics" target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">How metrics are calculated</span>
          </a>
          <a href="https://docs.github.com/en/copilot/reference/interpret-copilot-metrics" target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Interpreting Copilot metrics</span>
          </a>
        </div>
      </div>
    </v-card>

    <!-- KPI tiles -->
    <div class="tiles-container">
      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Chat Interactions</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Total user-initiated chat prompts sent to Copilot over the period.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
            <p class="text-h3 font-weight-bold text-primary mt-1">{{ formatCompact(cumulativeNumberTurns) }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Code Actions</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Total apply/insert/copy actions taken from chat responses.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
            <p class="text-h3 font-weight-bold text-success mt-1">{{ formatCompact(cumulativeNumberAcceptances) }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Action Rate</div>
              </template>
              <v-card class="pa-3 metric-tooltip">
                <span class="tooltip-text">Percentage of chat interactions that resulted in a code action (apply/insert/copy).</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
            <p class="text-h3 font-weight-bold text-info mt-1">{{ actionRate }}%</p>
            <v-progress-linear :model-value="Number(actionRate)" color="info" bg-color="surface-variant" rounded height="6" class="mt-2 mx-2" />
          </div>
        </v-card-item>
      </v-card>
    </div>

    <!-- Charts -->
    <v-row class="mx-1 mt-2">
      <!-- Chat interactions & code actions over time — full width -->
      <v-col cols="12">
        <v-card variant="outlined" class="pa-4">
          <div class="text-subtitle-1 font-weight-medium mb-1">Daily Chat Interactions &amp; Code Actions</div>
          <div class="text-caption text-medium-emphasis mb-3">
            Chat interactions = user prompts · Code actions = apply / insert / copy from chat
          </div>
          <div style="height:240px">
            <Line :data="interactionsChartData" :options="lineOptions" :plugins="[gradientFillPlugin, weekendPlugin]" />
          </div>
        </v-card>
      </v-col>
    </v-row>

    <v-row class="mx-1 mt-2 mb-4">
      <!-- Daily active chat users -->
      <v-col cols="12" md="7">
        <v-card variant="outlined" class="pa-4">
          <div class="text-subtitle-1 font-weight-medium mb-1">Daily Active Chat Users</div>
          <div class="text-caption text-medium-emphasis mb-3">Users with at least one chat interaction per day</div>
          <div style="height:220px">
            <Bar :data="activeUsersChartData" :options="barOptions" :plugins="[weekendPlugin]" />
          </div>
        </v-card>
      </v-col>

      <!-- Actions per interaction ratio -->
      <v-col cols="12" md="5">
        <v-card variant="outlined" class="pa-4">
          <div class="text-subtitle-1 font-weight-medium mb-1">Daily Action Rate</div>
          <div class="text-caption text-medium-emphasis mb-3">Code actions ÷ chat interactions per day (%)</div>
          <div style="height:220px">
            <Line :data="actionRateChartData" :options="pctOptions" :plugins="[gradientFillPlugin, weekendPlugin]" />
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, toRef } from 'vue';
import type { Metrics } from '@/model/Metrics';
import { Line, Bar } from 'vue-chartjs';
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
} from 'chart.js';
import { weekendPlugin, gradientFillPlugin, PALETTE, formatCompact } from '@/utils/chartPlugins';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

export default defineComponent({
  name: 'CopilotChatViewer',
  components: { Line, Bar },
  props: {
    metrics: {
      type: Object,
      required: true
    },
    dateRangeDescription: {
      type: String,
      default: 'Over the last 28 days'
    }
  },
  setup(props) {
    const data = toRef(props, 'metrics').value as Metrics[];

    const cumulativeNumberTurns = ref(
      data.reduce((s: number, m: Metrics) => s + m.total_chat_turns, 0)
    );
    const cumulativeNumberAcceptances = ref(
      data.reduce((s: number, m: Metrics) => s + m.total_chat_acceptances, 0)
    );

    const actionRate = computed(() => {
      if (cumulativeNumberTurns.value === 0) return '0.0';
      return ((cumulativeNumberAcceptances.value / cumulativeNumberTurns.value) * 100).toFixed(1);
    });

    const labels = data.map((m: Metrics) => m.day);

    const interactionsChartData = ref({
      labels,
      datasets: [
        {
          label: 'Chat Interactions',
          data: data.map((m: Metrics) => m.total_chat_turns),
          borderColor: PALETTE[3].border,
          backgroundColor: PALETTE[3].bg,
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Code Actions',
          data: data.map((m: Metrics) => m.total_chat_acceptances),
          borderColor: PALETTE[2].border,
          backgroundColor: PALETTE[2].bg,
          fill: true,
          tension: 0.3,
        },
      ],
    });

    const activeUsersChartData = ref({
      labels,
      datasets: [
        {
          label: 'Active Chat Users',
          data: data.map((m: Metrics) => m.total_active_chat_users),
          backgroundColor: PALETTE[0].bg,
          borderColor: PALETTE[0].border,
          borderRadius: 4,
        },
      ],
    });

    const actionRateChartData = ref({
      labels,
      datasets: [
        {
          label: 'Action Rate %',
          data: data.map((m: Metrics) =>
            m.total_chat_turns > 0
              ? Number(((m.total_chat_acceptances / m.total_chat_turns) * 100).toFixed(1))
              : 0
          ),
          borderColor: PALETTE[1].border,
          backgroundColor: PALETTE[1].bg,
          fill: true,
          tension: 0.3,
        },
      ],
    });

    const lineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      scales: {
        x: { ticks: { maxTicksLimit: 14 } },
        y: { beginAtZero: true },
      },
      plugins: { legend: { position: 'bottom' as const } },
    };

    const barOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxTicksLimit: 14 } },
        y: { beginAtZero: true, ticks: { stepSize: 1 } },
      },
      plugins: { legend: { position: 'bottom' as const } },
    };

    const pctOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { ticks: { maxTicksLimit: 14 } },
        y: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => v + '%' } },
      },
      plugins: { legend: { position: 'bottom' as const } },
    };

    return {
      cumulativeNumberTurns,
      cumulativeNumberAcceptances,
      actionRate,
      interactionsChartData,
      activeUsersChartData,
      actionRateChartData,
      lineOptions,
      barOptions,
      pctOptions,
      weekendPlugin,
      gradientFillPlugin,
      formatCompact,
    };
  },
});
</script>

<template>
  <div>
    <!-- Info panel — same style as Organization tab -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-4 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="flex-shrink-0 mr-3">
          <div class="font-weight-bold text-body-1 mb-1">🤖 Agent Activity</div>
          <div class="text-medium-emphasis" style="max-width: 560px;">
            Tracks AI-generated code changes via Copilot's agent and edit features. Shows lines added and deleted
            by agents vs user-initiated edits, broken down by mode, model, and language. Agent contribution %
            measures how much of AI code output came from agentic (autonomous) operations vs user-guided edits.
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
          <a href="https://docs.github.com/en/copilot/reference/copilot-usage-metrics/lines-of-code-metrics" target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Lines of Code metrics</span>
          </a>
        </div>
      </div>
    </v-card>

    <!-- KPI Row 1 -->
    <v-row class="mb-2 mx-1">
      <v-col cols="12" sm="4">
        <v-card variant="elevated" class="pa-4 text-center" height="160">
          <v-card-item>
            <div class="text-caption text-medium-emphasis">Lines of code changed with AI</div>
            <div class="text-caption text-medium-emphasis mb-2">{{ dateRangeDescription }}</div>
            <div class="text-h4 font-weight-bold">{{ formatCompact(totalLocChanged) }}</div>
          </v-card-item>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="elevated" class="pa-4 text-center" height="160">
          <v-card-item>
            <div class="text-caption text-medium-emphasis">Agent contribution</div>
            <div class="text-caption text-medium-emphasis mb-2">% of all AI code changes</div>
            <div class="text-h4 font-weight-bold">{{ agentContributionPct.toFixed(0) }}%</div>
            <div class="text-caption text-medium-emphasis mt-1">
              {{ formatCompact(agentLocChanged) }} of {{ formatCompact(totalLocChanged) }} lines
            </div>
          </v-card-item>
        </v-card>
      </v-col>
      <v-col cols="12" sm="4">
        <v-card variant="elevated" class="pa-4 text-center" height="160">
          <v-card-item>
            <div class="text-caption text-medium-emphasis">Avg lines deleted by agent per user</div>
            <div class="text-caption text-medium-emphasis mb-2">{{ dateRangeDescription }}</div>
            <div class="text-h4 font-weight-bold">{{ avgAgentLinesDeleted.toLocaleString() }}</div>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <!-- Daily LOC chart (full width) -->
    <v-row class="mx-1 mb-2">
      <v-col cols="12">
        <v-card variant="outlined" class="pa-4">
          <div class="text-subtitle-1 font-weight-medium mb-1">Daily lines added &amp; deleted (all AI)</div>
          <div class="text-caption text-medium-emphasis mb-3">Lines added and deleted by all Copilot features per day</div>
          <div style="height:220px">
            <Bar :data="dailyLocChartData" :options="dailyLocOptions" />
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- User-initiated vs Agent-initiated side by side -->
    <v-row class="mx-1 mb-2">
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4" height="300">
          <div class="text-subtitle-1 font-weight-medium mb-1">User-initiated code changes by mode</div>
          <div class="text-caption text-medium-emphasis mb-3">Lines added/deleted per feature (excluding agent_edit)</div>
          <div style="height:210px">
            <Bar :data="userInitiatedChartData" :options="sideBarOptions" />
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4" height="300">
          <div class="text-subtitle-1 font-weight-medium mb-1">Agent-initiated code changes</div>
          <div class="text-caption text-medium-emphasis mb-3">Lines added/deleted by agent_edit over time</div>
          <div style="height:210px">
            <Bar :data="agentInitiatedChartData" :options="sideBarOptions" />
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Per-model side by side -->
    <v-row class="mx-1 mb-2">
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4" height="300">
          <div class="text-subtitle-1 font-weight-medium mb-1">User-initiated per model</div>
          <div class="text-caption text-medium-emphasis mb-3">Lines added by model (user features)</div>
          <div style="height:210px">
            <Bar :data="userModelChartData" :options="horizontalBarOptions" />
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4" height="300">
          <div class="text-subtitle-1 font-weight-medium mb-1">Agent-initiated per model</div>
          <div class="text-caption text-medium-emphasis mb-3">Lines added by model (agent_edit)</div>
          <div style="height:210px">
            <Bar :data="agentModelChartData" :options="horizontalBarOptions" />
          </div>
        </v-card>
      </v-col>
    </v-row>

    <!-- Per-language side by side -->
    <v-row class="mx-1 mb-4">
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4" height="300">
          <div class="text-subtitle-1 font-weight-medium mb-1">User-initiated per language</div>
          <div class="text-caption text-medium-emphasis mb-3">Lines added by language (user features)</div>
          <div style="height:210px">
            <Bar :data="userLanguageChartData" :options="horizontalBarOptions" />
          </div>
        </v-card>
      </v-col>
      <v-col cols="12" md="6">
        <v-card variant="outlined" class="pa-4" height="300">
          <div class="text-subtitle-1 font-weight-medium mb-1">Agent-initiated per language</div>
          <div class="text-caption text-medium-emphasis mb-3">Lines added by language (agent_edit)</div>
          <div style="height:210px">
            <Bar :data="agentLanguageChartData" :options="horizontalBarOptions" />
          </div>
        </v-card>
      </v-col>
    </v-row>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watchEffect, type PropType } from 'vue';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  BarElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const PALETTE = ['#4C9BE8', '#E8834C', '#4CE88A', '#E8E04C', '#C44CE8', '#4CE8E0'];
const AGENT_COLOR = '#E8834C';
const USER_COLOR  = '#4C9BE8';

const FEATURE_DISPLAY: Record<string, string> = {
  code_completion: 'Completions',
  agent_edit: 'Edit (Agent)',
  chat_panel_ask_mode: 'Ask',
  chat_panel_agent_mode: 'Agent',
  chat_panel_custom_mode: 'Custom',
  chat_inline: 'Inline',
  plan_mode: 'Plan',
};

const USER_FEATURES = ['code_completion', 'chat_panel_ask_mode', 'chat_panel_agent_mode',
  'chat_inline', 'chat_panel_custom_mode', 'plan_mode'];

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

export default defineComponent({
  name: 'AgentActivityViewer',
  components: { Bar },
  props: {
    reportData: { type: Array as PropType<ReportDayTotals[]>, required: true },
    dateRangeDescription: { type: String, default: 'Over the last 28 days' },
  },
  setup(props) {
    const totalLocChanged      = ref(0);
    const agentLocChanged      = ref(0);
    const agentContributionPct = ref(0);
    const avgAgentLinesDeleted = ref(0);

    const dailyLocChartData      = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const userInitiatedChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const agentInitiatedChartData= ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const userModelChartData     = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const agentModelChartData    = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const userLanguageChartData  = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const agentLanguageChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const baseOpts = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top' as const }, tooltip: { mode: 'index' as const } },
    };

    const dailyLocOptions = {
      ...baseOpts,
      scales: { x: { stacked: false }, y: { beginAtZero: true, stacked: false } },
    };

    const sideBarOptions = {
      ...baseOpts,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    };

    const horizontalBarOptions = {
      ...baseOpts,
      indexAxis: 'y' as const,
      scales: { x: { beginAtZero: true }, y: {} },
    };

    watchEffect(() => {
      const data = toRef(props, 'reportData').value;
      if (!data || data.length === 0) return;

      const labels = data.map(d => d.date ?? d.day);

      // ── KPI totals ────────────────────────────────────────────
      let totalAdded = 0, totalDeleted = 0, agentAdded = 0, agentDeleted = 0;
      data.forEach(day => {
        totalAdded   += day.loc_added_sum   ?? 0;
        totalDeleted += day.loc_deleted_sum ?? 0;
        const ae = (day.totals_by_feature ?? []).find(f => f.feature === 'agent_edit');
        if (ae) { agentAdded += ae.loc_added_sum ?? 0; agentDeleted += ae.loc_deleted_sum ?? 0; }
      });
      totalLocChanged.value  = totalAdded + totalDeleted;
      agentLocChanged.value  = agentAdded + agentDeleted;
      agentContributionPct.value = totalLocChanged.value === 0 ? 0
        : (agentLocChanged.value / totalLocChanged.value) * 100;
      const latestDay = data[data.length - 1];
      const mau = latestDay.monthly_active_users ?? 1;
      avgAgentLinesDeleted.value = mau > 0 ? Math.round(agentDeleted / mau) : 0;

      // ── Daily LOC (added + deleted by day) ────────────────────
      dailyLocChartData.value = {
        labels,
        datasets: [
          { label: 'Lines Added',   data: data.map(d => d.loc_added_sum   ?? 0), backgroundColor: USER_COLOR,  borderRadius: 3 },
          { label: 'Lines Deleted', data: data.map(d => d.loc_deleted_sum ?? 0), backgroundColor: AGENT_COLOR, borderRadius: 3 },
        ],
      };

      // ── User-initiated features (lines added per day stacked) ──
      const presentUserFeatures = [...new Set(
        data.flatMap(d => (d.totals_by_feature ?? []).map(f => f.feature))
      )].filter(f => USER_FEATURES.includes(f));

      userInitiatedChartData.value = {
        labels,
        datasets: presentUserFeatures.map((feat, i) => ({
          label: FEATURE_DISPLAY[feat] ?? feat,
          data: data.map(d => {
            const f = (d.totals_by_feature ?? []).find(x => x.feature === feat);
            return (f?.loc_added_sum ?? 0) + (f?.loc_deleted_sum ?? 0);
          }),
          backgroundColor: PALETTE[i % PALETTE.length],
          borderRadius: 3,
        })),
      };

      // ── Agent-initiated (agent_edit LOC per day) ───────────────
      agentInitiatedChartData.value = {
        labels,
        datasets: [
          {
            label: 'Lines Added',
            data: data.map(d => (d.totals_by_feature ?? []).find(f => f.feature === 'agent_edit')?.loc_added_sum ?? 0),
            backgroundColor: USER_COLOR, borderRadius: 3,
          },
          {
            label: 'Lines Deleted',
            data: data.map(d => (d.totals_by_feature ?? []).find(f => f.feature === 'agent_edit')?.loc_deleted_sum ?? 0),
            backgroundColor: AGENT_COLOR, borderRadius: 3,
          },
        ],
      };

      // ── Per-model aggregation ─────────────────────────────────
      const userModelMap  = new Map<string, number>();
      const agentModelMap = new Map<string, number>();
      data.forEach(day => {
        (day.totals_by_model_feature ?? []).forEach(mf => {
          const loc = (mf.loc_added_sum ?? 0) + (mf.loc_deleted_sum ?? 0);
          if (mf.feature === 'agent_edit') {
            agentModelMap.set(mf.model, (agentModelMap.get(mf.model) ?? 0) + loc);
          } else {
            userModelMap.set(mf.model, (userModelMap.get(mf.model) ?? 0) + loc);
          }
        });
      });
      const topUserModels  = [...userModelMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);
      const topAgentModels = [...agentModelMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6);

      userModelChartData.value = {
        labels: topUserModels.map(([m]) => m),
        datasets: [{ label: 'Lines Changed', data: topUserModels.map(([,v]) => v), backgroundColor: PALETTE, borderRadius: 3 }],
      };
      agentModelChartData.value = {
        labels: topAgentModels.map(([m]) => m),
        datasets: [{ label: 'Lines Changed', data: topAgentModels.map(([,v]) => v), backgroundColor: PALETTE, borderRadius: 3 }],
      };

      // ── Per-language aggregation ──────────────────────────────
      const userLangMap  = new Map<string, number>();
      const agentLangMap = new Map<string, number>();
      data.forEach(day => {
        (day.totals_by_language_feature ?? []).forEach(lf => {
          const loc = (lf.loc_added_sum ?? 0) + (lf.loc_deleted_sum ?? 0);
          if (lf.feature === 'agent_edit') {
            agentLangMap.set(lf.language, (agentLangMap.get(lf.language) ?? 0) + loc);
          } else {
            userLangMap.set(lf.language, (userLangMap.get(lf.language) ?? 0) + loc);
          }
        });
      });
      const topUserLangs  = [...userLangMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);
      const topAgentLangs = [...agentLangMap.entries()].sort((a,b)=>b[1]-a[1]).slice(0,8);

      userLanguageChartData.value = {
        labels: topUserLangs.map(([l]) => l),
        datasets: [{ label: 'Lines Changed', data: topUserLangs.map(([,v]) => v), backgroundColor: PALETTE, borderRadius: 3 }],
      };
      agentLanguageChartData.value = {
        labels: topAgentLangs.map(([l]) => l),
        datasets: [{ label: 'Lines Changed', data: topAgentLangs.map(([,v]) => v), backgroundColor: PALETTE, borderRadius: 3 }],
      };
    });

    return {
      totalLocChanged, agentLocChanged, agentContributionPct, avgAgentLinesDeleted,
      dailyLocChartData, userInitiatedChartData, agentInitiatedChartData,
      userModelChartData, agentModelChartData, userLanguageChartData, agentLanguageChartData,
      dailyLocOptions, sideBarOptions, horizontalBarOptions,
      formatCompact,
    };
  },
});
</script>

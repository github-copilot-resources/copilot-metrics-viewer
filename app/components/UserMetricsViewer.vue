<template>
  <div>
    <!-- Summary tiles -->
    <div class="tiles-container">
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 250px; height: 150px;">
        <v-card-item class="d-flex justify-center align-center" style="height: 100%;">
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="text-h6 mb-1">Total Users</div>
                <div class="text-caption">Users with Copilot activity</div>
                <p class="text-h4">{{ totalUsers }}</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Total number of users who had any Copilot activity (code completions, chat, or agent) during the reporting period.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 250px; height: 150px;">
        <v-card-item class="d-flex justify-center align-center" style="height: 100%;">
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="text-h6 mb-1">Active Users</div>
                <div class="text-caption">Active in last 7 days of period</div>
                <p class="text-h4">{{ activeUsers }}</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Users who were active in the last 7 days of the reporting window. Helps identify current engagement vs dormant users.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-4" style="width: 260px; height: 150px;">
        <v-card-item class="d-flex justify-center align-center" style="height: 100%;">
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="text-h6 mb-1">Avg Acceptance Rate</div>
                <div class="text-caption">Code completions accepted</div>
                <p class="text-h4">{{ avgAcceptanceRate }}%</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Average ratio of accepted inline code completions to total suggestions across all users. Only measures ghost-text suggestions — does not include Chat, Agent, CLI, or GitHub.com interactions.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>
    </div>

    <!-- Search and filter controls -->
    <v-main class="p-1" style="min-height: 300px;">
      <v-container class="px-4 elevation-2">
        <br>
        <h2>Per-User Copilot Usage Metrics</h2>
        <div class="text-caption mb-4">{{ dateRangeDescription }}</div>

        <!-- Understanding your metrics -->
        <v-expansion-panels variant="accordion" class="mb-4">
          <v-expansion-panel>
            <v-expansion-panel-title>
              <v-icon size="small" class="mr-2">mdi-information-outline</v-icon>
              Understanding your metrics
            </v-expansion-panel-title>
            <v-expansion-panel-text>
              <div class="text-body-2">
                <h4 class="mb-2">📊 What the numbers mean</h4>
                <ul class="ml-4 mb-3">
                  <li><strong>Copilot LOC</strong> (Lines of Code) is the <em>total</em> lines of code added via all Copilot features — inline completions, Chat apply/insert, and Agent edits combined. It is <strong>not</strong> limited to code completions.</li>
                  <li><strong>Acceptance Rate</strong> measures <em>inline code completions only</em> — the ghost-text suggestions shown in the editor. It does <strong>not</strong> include Chat, Agent mode, Copilot CLI, or GitHub.com interactions.</li>
                  <li><strong>Interactions</strong> counts all user-initiated events across features (completions, chat messages, agent requests).</li>
                  <li><strong>Chat</strong> shows total activity across Copilot Chat modes (ask, agent, edit, inline). Hover for a per-mode breakdown.</li>
                  <li><strong>Agent</strong> shows activity specifically in agent mode and agent edit. Users working primarily with agents will have high numbers here but may show low acceptance rates — that's expected.</li>
                  <li><strong>Agent LOC</strong> shows lines of code added specifically by agent features (agent mode + agent edit). Compare with Copilot LOC to see how much of a user's Copilot-generated code comes from agents.</li>
                </ul>

                <h4 class="mb-2">🧑‍💻 How users are using Copilot</h4>
                <ul class="ml-4 mb-3">
                  <li><strong>Inline completions users</strong> — high Completions/Accepted counts, high Acceptance Rate, Copilot LOC mostly from completions (Agent LOC near zero).</li>
                  <li><strong>Chat-first users</strong> — high Chat count, moderate Copilot LOC from copy/apply actions, low Acceptance Rate (they don't rely on ghost-text).</li>
                  <li><strong>Agent-heavy users</strong> — high Agent count, Copilot LOC ≈ Agent LOC (almost all their code comes from agents). Often have near-zero acceptance rates — this is normal and expected.</li>
                  <li><strong>CLI / GitHub.com users</strong> — may show surprisingly low numbers because CLI usage is only tracked at the org aggregate level (no per-user breakdown), and GitHub.com Copilot interactions may only partially appear in Chat metrics.</li>
                </ul>

                <h4 class="mb-2">🔍 What's not captured per user</h4>
                <ul class="ml-4 mb-3">
                  <li><strong>Copilot CLI</strong> usage is only tracked as an aggregate count at the organization level — there is no per-user CLI breakdown.</li>
                  <li><strong>GitHub.com Copilot</strong> (PR summaries, issue chat) shows partially under Chat features but detailed stats are aggregate-only.</li>
                  <li><strong>Pull request metrics</strong> (Copilot-authored PRs, reviews) are available in the Agent Activity tab but not broken down per user.</li>
                  <li><strong>Merged PR lines</strong> — when you merge a Copilot agent PR, the merge itself is not counted in Copilot LOC; only the original agent code generation event is tracked.</li>
                </ul>

                <h4 class="mb-2">💡 Tips for adoption tracking</h4>
                <ul class="ml-4 mb-3">
                  <li>A <strong>low acceptance rate</strong> doesn't mean low Copilot value — users who rely on Chat and Agent mode get significant value without triggering inline completions.</li>
                  <li>Look at <strong>Active Days</strong> and <strong>Interactions</strong> for a fuller picture of engagement rather than acceptance rate alone.</li>
                  <li>Compare <strong>Copilot LOC</strong> vs <strong>Agent LOC</strong> — if they're nearly equal, the user is primarily agent-driven.</li>
                  <li>Use the <strong>Chat</strong> and <strong>Agent</strong> columns to identify users who have adopted advanced Copilot features beyond code completion.</li>
                  <li>Users with <strong>0 active days</strong> may need onboarding support or may not have Copilot configured in their IDE.</li>
                </ul>

                <div class="text-caption d-flex flex-column ga-1">
                  <a href="https://docs.github.com/en/copilot/rolling-out-github-copilot-at-scale/analyzing-usage-over-time" target="_blank" rel="noopener">
                    📖 Analyzing Copilot usage over time
                  </a>
                  <a href="https://docs.github.com/en/copilot/tutorials/roll-out-at-scale" target="_blank" rel="noopener">
                    🚀 Rolling out GitHub Copilot at scale
                  </a>
                  <a href="https://docs.github.com/en/copilot/tutorials/roll-out-at-scale/enable-developers/drive-adoption" target="_blank" rel="noopener">
                    📈 Driving Copilot adoption in your company
                  </a>
                  <a href="https://docs.github.com/en/copilot/tutorials/roll-out-at-scale/measure-success" target="_blank" rel="noopener">
                    🎯 Measuring the success of a Copilot trial
                  </a>
                  <a href="https://docs.github.com/en/copilot/tutorials/roll-out-at-scale/assign-licenses/track-usage-and-adoption" target="_blank" rel="noopener">
                    📋 Tracking license activation and usage
                  </a>
                  <a href="https://docs.github.com/en/copilot/tutorials/roll-out-at-scale/maintain-codebase-standards" target="_blank" rel="noopener">
                    🔒 Maintaining codebase standards in a rollout
                  </a>
                </div>
              </div>
            </v-expansion-panel-text>
          </v-expansion-panel>
        </v-expansion-panels>

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
              <td class="text-center">
                <v-tooltip v-if="item.loc_added_sum > 0" location="top" :z-index="2147483647">
                  <template #activator="{ props: tip }">
                    <span v-bind="tip" class="font-weight-medium" style="cursor: help;">{{ item.loc_added_sum.toLocaleString() }}</span>
                  </template>
                  <v-card class="pa-3 metric-tooltip">
                    <span class="tooltip-text" style="white-space: pre-line">{{ getLocBreakdown(item) }}</span>
                  </v-card>
                </v-tooltip>
                <span v-else class="text-disabled">0</span>
              </td>
              <td class="text-center">{{ getTopIde(item) }}</td>
              <td class="text-center">{{ getTopLanguage(item) }}</td>
              <td class="text-center">
                <v-tooltip v-if="getChatInteractions(item) > 0" location="top" :z-index="2147483647">
                  <template #activator="{ props: tip }">
                    <span v-bind="tip" class="text-indigo font-weight-medium" style="cursor: help;">{{ getChatInteractions(item).toLocaleString() }}</span>
                  </template>
                  <v-card class="pa-3 metric-tooltip">
                    <span class="tooltip-text" style="white-space: pre-line">{{ getFeatureTooltip(item, CHAT_FEATURES) }}</span>
                  </v-card>
                </v-tooltip>
                <span v-else class="text-disabled">0</span>
              </td>
              <td class="text-center">
                <v-tooltip v-if="getAgentActivity(item) > 0" location="top" :z-index="2147483647">
                  <template #activator="{ props: tip }">
                    <span v-bind="tip" class="text-deep-purple font-weight-medium" style="cursor: help;">{{ getAgentActivity(item).toLocaleString() }}</span>
                  </template>
                  <v-card class="pa-3 metric-tooltip">
                    <span class="tooltip-text" style="white-space: pre-line">{{ getFeatureTooltip(item, AGENT_FEATURES) }}</span>
                  </v-card>
                </v-tooltip>
                <span v-else class="text-disabled">0</span>
              </td>
              <td class="text-center">
                <span v-if="getAgentLoc(item) > 0" class="font-weight-medium">{{ getAgentLoc(item).toLocaleString() }}</span>
                <span v-else class="text-disabled">0</span>
              </td>
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
import { CHAT_FEATURES, AGENT_FEATURES, COMPLETION_FEATURES, FEATURE_LABELS } from '../../shared/utils/feature-classification';
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

    const totalUsers = computed(() => props.userMetrics.length);

    const activeUsers = computed(() =>
      props.userMetrics.filter(u => u.total_active_days >= 7).length
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

    function hasFeatureActivity(user: UserTotals, features: string[]): boolean {
      if (!user.totals_by_feature) return false;
      return user.totals_by_feature.some(
        f => features.includes(f.feature) &&
          (f.user_initiated_interaction_count > 0 || f.code_generation_activity_count > 0),
      );
    }

    function getFeatureActivityCount(user: UserTotals, features: string[]): number {
      if (!user.totals_by_feature) return 0;
      return user.totals_by_feature
        .filter(f => features.includes(f.feature))
        .reduce((sum, f) => sum + f.user_initiated_interaction_count + f.code_generation_activity_count, 0);
    }

    function getChatInteractions(user: UserTotals): number {
      return getFeatureActivityCount(user, CHAT_FEATURES);
    }

    function getAgentActivity(user: UserTotals): number {
      return getFeatureActivityCount(user, AGENT_FEATURES);
    }

    function getFeatureLoc(user: UserTotals, features: string[]): number {
      if (!user.totals_by_feature) return 0;
      return user.totals_by_feature
        .filter(f => features.includes(f.feature))
        .reduce((sum, f) => sum + (f.loc_added_sum || 0), 0);
    }

    function getAgentLoc(user: UserTotals): number {
      return getFeatureLoc(user, AGENT_FEATURES);
    }

    function getLocBreakdown(user: UserTotals): string {
      const total = user.loc_added_sum || 0;
      const completionLoc = getFeatureLoc(user, COMPLETION_FEATURES);
      const chatLoc = getFeatureLoc(user, CHAT_FEATURES.filter(f => !AGENT_FEATURES.includes(f)));
      const agentLoc = getFeatureLoc(user, AGENT_FEATURES);
      const lines: string[] = [`Total Copilot LOC: ${total.toLocaleString()}`];
      if (completionLoc > 0) lines.push(`  Inline completions: ${completionLoc.toLocaleString()}`);
      if (chatLoc > 0) lines.push(`  Chat (ask/edit/inline): ${chatLoc.toLocaleString()}`);
      if (agentLoc > 0) lines.push(`  Agent: ${agentLoc.toLocaleString()}`);
      if (agentLoc > 0 && total > 0) {
        const pct = Math.round((agentLoc / total) * 100);
        lines.push(`${pct}% of LOC from agents`);
      }
      return lines.join('\n');
    }

    function usesChat(user: UserTotals): boolean {
      return hasFeatureActivity(user, CHAT_FEATURES);
    }

    function usesAgent(user: UserTotals): boolean {
      return hasFeatureActivity(user, AGENT_FEATURES);
    }

    function getFeatureTooltip(user: UserTotals, features: string[]): string {
      if (!user.totals_by_feature) return 'No feature data';
      const active = user.totals_by_feature.filter(
        f => features.includes(f.feature) &&
          (f.user_initiated_interaction_count > 0 || f.code_generation_activity_count > 0),
      );
      if (active.length === 0) return 'No activity';
      return active.map(f => {
        const label = FEATURE_LABELS[f.feature] || f.feature;
        const parts: string[] = [];
        if (f.user_initiated_interaction_count > 0)
          parts.push(`${f.user_initiated_interaction_count} interactions`);
        if (f.code_generation_activity_count > 0)
          parts.push(`${f.code_generation_activity_count} code gen`);
        if (f.loc_added_sum > 0)
          parts.push(`${f.loc_added_sum} LOC`);
        return `${label}: ${parts.join(', ')}`;
      }).join('\n');
    }

    const tableHeaders = computed(() => {
      const cols: { title: string; key: string; sortable?: boolean }[] = [
        { title: 'User',           key: 'login',                            sortable: true  },
        { title: 'Active Days',    key: 'total_active_days',                sortable: true  },
        { title: 'Interactions',   key: 'user_initiated_interaction_count', sortable: true  },
        { title: 'Completions',    key: 'code_generation_activity_count',   sortable: true  },
        { title: 'Accepted',       key: 'code_acceptance_activity_count',   sortable: true  },
        { title: 'Accept Rate',    key: 'acceptance_rate',                  sortable: false },
        { title: 'Copilot LOC',  key: 'loc_added_sum',                    sortable: true  },
      ];
      cols.push(
        { title: 'Top IDE',        key: 'top_ide',                          sortable: false },
        { title: 'Top Language',   key: 'top_language',                     sortable: false },
        { title: 'Chat',           key: 'uses_chat',                        sortable: true  },
        { title: 'Agent',          key: 'uses_agent',                       sortable: true  },
        { title: 'Agent LOC',      key: 'agent_loc',                        sortable: true  },
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
      return { labels: props.userMetricsHistory.map(e => e.report_end_day), datasets };
    });

    const historyChartOptions = computed(() => {
      const scales: Record<string, object> = {
        yUsers: { type: 'linear' as const, position: 'left' as const, beginAtZero: true, title: { display: true, text: 'Users' } },
      };
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
        { title: 'Avg Acceptance',     key: 'avg_acceptance_rate' },
      ];
      return cols;
    });

    return {
      search,
      activityFilter,
      activityFilterOptions,
      totalUsers,
      activeUsers,
      avgAcceptanceRate,
      filteredUsers,
      tableHeaders,
      getAcceptanceRate,
      getActivityColor,
      getTopIde,
      getTopLanguage,
      usesChat,
      usesAgent,
      getChatInteractions,
      getAgentActivity,
      getAgentLoc,
      getLocBreakdown,
      getFeatureTooltip,
      CHAT_FEATURES,
      AGENT_FEATURES,
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

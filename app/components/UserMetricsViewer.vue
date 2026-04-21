<template>
  <div>
    <!-- Info panel — same style as Organization tab -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-2 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">👤 User Metrics</div>
          <div class="text-medium-emphasis">
            Per-user Copilot activity breakdown for the reporting period. Shows interactions, code
            completions, acceptance rates, and AI-generated lines of code per developer.
          </div>
        </div>
        <v-divider vertical class="mx-2 hidden-sm-and-down" />
        <div class="d-flex flex-column gap-1">
          <div class="text-caption text-medium-emphasis font-weight-medium mb-1">LEARN MORE</div>
          <a href="https://docs.github.com/en/copilot/reference/interpret-copilot-metrics" target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Interpreting Copilot metrics</span>
          </a>
          <a href="https://docs.github.com/en/copilot/tutorials/roll-out-at-scale" target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Rolling out at scale</span>
          </a>
        </div>
      </div>
    </v-card>

    <!-- Understanding metrics — collapsible, at the top -->
    <v-expansion-panels variant="accordion" class="mx-4 mb-3">
      <v-expansion-panel>
        <v-expansion-panel-title>
          <v-icon size="small" class="mr-2">mdi-information-outline</v-icon>
          Understanding your metrics
        </v-expansion-panel-title>
        <v-expansion-panel-text>
          <div class="text-body-2">
            <h4 class="mb-2">📊 What the numbers mean</h4>
            <ul class="ml-4 mb-3">
              <li><strong>Copilot LOC</strong> — total lines of code added via all Copilot features (completions, Chat apply/insert, Agent edits). Not limited to code completions.</li>
              <li><strong>Acceptance Rate</strong> — measures <em>inline code completions only</em> (ghost-text). Does not include Chat, Agent, CLI, or GitHub.com interactions.</li>
              <li><strong>Interactions</strong> — all user-initiated events across features (completions, chat messages, agent requests).</li>
              <li><strong>Chat</strong> — activity across Copilot Chat modes (ask, agent, edit, inline).</li>
              <li><strong>Agent</strong> — activity specifically in agent mode and agent edit. Low acceptance rates are expected for agent-heavy users.</li>
              <li><strong>Agent LOC</strong> — lines added specifically by agent features. Compare with Copilot LOC to see agent share of a user's output.</li>
            </ul>
            <h4 class="mb-2">🔍 What's not captured per user</h4>
            <ul class="ml-4 mb-3">
              <li><strong>Copilot CLI</strong> — tracked only as an org-level aggregate; no per-user breakdown.</li>
              <li><strong>GitHub.com Copilot</strong> (PR summaries, issue chat) — partially appears under Chat features but detailed stats are aggregate-only.</li>
            </ul>
            <h4 class="mb-2">💡 Tips</h4>
            <ul class="ml-4 mb-2">
              <li>A low acceptance rate doesn't mean low value — Chat/Agent users get significant value without inline completions.</li>
              <li>Look at <strong>Active Days</strong> and <strong>Interactions</strong> for a fuller picture of engagement.</li>
              <li>If Copilot LOC ≈ Agent LOC, the user is primarily agent-driven.</li>
            </ul>
          </div>
        </v-expansion-panel-text>
      </v-expansion-panel>
    </v-expansion-panels>

    <!-- Summary tiles -->
    <div class="tiles-container">
      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="text-h6 mb-1">Total Users</div>
                <div class="text-caption text-medium-emphasis">Users with Copilot activity</div>
                <p class="kpi-value text-primary mt-1">{{ totalUsers }}</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Total number of users who had any Copilot activity (code completions, chat, or agent) during the reporting period.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="text-h6 mb-1">Active Users</div>
                <div class="text-caption text-medium-emphasis">Active ≥ 7 days</div>
                <p class="kpi-value text-success mt-1">{{ activeUsers }}</p>
                <v-progress-linear :model-value="totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0" color="success" bg-color="#C8E6C9" rounded height="6" class="mt-2 mx-2" />
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Users who were active in the last 7 days of the reporting window.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="text-h6 mb-1">Avg Acceptance Rate</div>
                <div class="text-caption text-medium-emphasis">Inline completions only</div>
                <p class="kpi-value text-info mt-1">{{ avgAcceptanceRate }}%</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Average ratio of accepted inline code completions across all users. Does not include Chat, Agent, or CLI interactions.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>
    </div>

    <!-- Charts -->
    <v-container v-if="userMetrics.length > 0" :fluid="chartColumns === 'full'" :class="['elevation-2 mt-2 mb-2', chartColumns === 'full' ? 'px-0' : 'px-4']">
      <div class="d-flex justify-end mb-2">
        <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
          <v-btn value="1" size="small" icon="mdi-view-agenda" title="Single column" />
          <v-btn value="2" size="small" icon="mdi-view-grid" title="Two columns" />
          <v-btn value="full" size="small" icon="mdi-fullscreen" title="Full width" />
        </v-btn-toggle>
      </div>
      <v-row class="mt-0 mb-2">
        <!-- Top users by interactions -->
        <v-col cols="12" :md="chartColumns === '2' ? 7 : 12">
          <v-card variant="outlined" class="pa-4">
            <div class="text-subtitle-1 font-weight-medium mb-1">Top Users by Interactions</div>
            <div class="text-caption text-medium-emphasis mb-3">Total Copilot interactions per developer (chat + completions + agent)</div>
            <div style="height:280px">
              <Bar :data="topUsersChartData" :options="topUsersOptions" />
            </div>
          </v-card>
        </v-col>

        <!-- User engagement distribution -->
        <v-col cols="12" :md="chartColumns === '2' ? 5 : 12">
          <v-card variant="outlined" class="pa-4">
            <div class="text-subtitle-1 font-weight-medium mb-1">Engagement Distribution</div>
            <div class="text-caption text-medium-emphasis mb-3">
              High ≥ 14 active days · Medium 7–13 · Low 1–6 · Inactive 0
            </div>
            <div style="height:280px">
              <Doughnut :data="distributionChartData" :options="distributionOptions" />
            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Search and filter controls -->
    <v-main class="p-1" style="min-height: 300px;">
      <v-container class="px-4 elevation-2">
        <br>
        <h2>Per-User Copilot Usage Metrics</h2>
        <div class="text-caption mb-4">{{ dateRangeDescription }}</div>

        <!-- Understanding your metrics moved to top of page -->
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
import { Line, Bar, Doughnut } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);

export default defineComponent({
  name: 'UserMetricsViewer',
  components: { Line, Bar, Doughnut },
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

    // ── Analytics charts ────────────────────────────────────────────────────
    const DIST_COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#F44336'];

    const topUsersChartData = computed(() => {
      const top10 = [...props.userMetrics]
        .sort((a, b) => b.user_initiated_interaction_count - a.user_initiated_interaction_count)
        .slice(0, 10);
      return {
        labels: top10.map(u => u.login),
        datasets: [
          {
            label: 'Interactions',
            data: top10.map(u => u.user_initiated_interaction_count),
            backgroundColor: 'rgba(54, 162, 235, 0.75)',
            borderColor: 'rgb(54, 162, 235)',
            borderRadius: 4,
          },
          {
            label: 'Copilot LOC',
            data: top10.map(u => u.loc_added_sum || 0),
            backgroundColor: 'rgba(75, 192, 192, 0.75)',
            borderColor: 'rgb(75, 192, 192)',
            borderRadius: 4,
          },
        ],
      };
    });

    const topUsersOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
      scales: {
        x: { beginAtZero: true },
        y: { ticks: { font: { size: 11 } } },
      },
      plugins: { legend: { position: 'bottom' as const } },
    };

    const distributionChartData = computed(() => {
      const high     = props.userMetrics.filter(u => u.total_active_days >= 14).length;
      const medium   = props.userMetrics.filter(u => u.total_active_days >= 7 && u.total_active_days < 14).length;
      const low      = props.userMetrics.filter(u => u.total_active_days >= 1 && u.total_active_days < 7).length;
      const inactive = props.userMetrics.filter(u => u.total_active_days === 0).length;
      return {
        labels: [
          `High (≥14 days) — ${high}`,
          `Medium (7–13) — ${medium}`,
          `Low (1–6) — ${low}`,
          `Inactive (0) — ${inactive}`,
        ],
        datasets: [{ data: [high, medium, low, inactive], backgroundColor: DIST_COLORS, borderWidth: 1 }],
      };
    });

    const distributionOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' as const, labels: { padding: 12 } },
        tooltip: {
          callbacks: {
            label: (ctx: any) => {
              const total = ctx.dataset.data.reduce((a: number, b: number) => a + b, 0);
              const pct = total > 0 ? ((ctx.parsed / total) * 100).toFixed(0) : '0';
              return ` ${ctx.label} (${pct}%)`;
            },
          },
        },
      },
    };

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
      topUsersChartData,
      topUsersOptions,
      distributionChartData,
      distributionOptions,
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
  },
  data() {
    return { chartColumns: '2' };
  },
});
</script>


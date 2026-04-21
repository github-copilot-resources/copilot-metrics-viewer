<template>
    <div>
        <!-- Info panel -->
        <v-card variant="outlined" class="mx-4 mt-3 mb-4 pa-3" density="compact">
          <div class="d-flex flex-wrap align-start gap-2 text-body-2">
            <div class="mr-3" style="flex: 1; min-width: 250px;">
              <div class="font-weight-bold text-body-1 mb-1">🤖 Models & Feature Usage</div>
              <div class="text-medium-emphasis">
                Deep dive into which AI models and features your organization uses. View interactions by model, feature, and their combination.
                For per-user breakdowns see the User Metrics tab; for agent/edit code-change stats see Agent Activity.
              </div>
            </div>
            <v-divider vertical class="mx-2 hidden-sm-and-down" />
            <div class="d-flex flex-column gap-1 flex-shrink-0">
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

        <!-- Loading state -->
        <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 200px;">
            <v-progress-circular indeterminate size="64" color="primary" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="mx-4">
            <v-alert type="error" class="mb-4">
                <v-alert-title>Error Loading Statistics</v-alert-title>
                {{ error }}
            </v-alert>
        </div>

        <!-- Main content -->
        <div v-else>
            <!-- KPI Tiles -->
            <div class="tiles-container">
                <v-card elevation="4" color="surface" variant="elevated" class="my-2">
                    <v-card-item>
                        <div class="tiles-text">
                            <div class="spacing-10"/>
                            <div class="text-h6 mb-1">Code Completions</div>
                            <div class="text-caption text-medium-emphasis">IDE users with activity</div>
                            <p class="kpi-value mt-1 text-primary">{{ stats.totalIdeCodeCompletionUsers }}</p>
                            <div class="text-caption text-medium-emphasis mt-1">{{ stats.totalIdeCodeCompletionModels }} models used</div>
                        </div>
                    </v-card-item>
                </v-card>

                <v-card elevation="4" color="surface" variant="elevated" class="my-2">
                    <v-card-item>
                        <div class="tiles-text">
                            <div class="spacing-10"/>
                            <div class="text-h6 mb-1">IDE Chat</div>
                            <div class="text-caption text-medium-emphasis">Users with chat activity</div>
                            <p class="kpi-value mt-1 text-success">{{ stats.totalIdeChatUsers }}</p>
                            <div class="text-caption text-medium-emphasis mt-1">{{ stats.totalIdeChatModels }} models used</div>
                        </div>
                    </v-card-item>
                </v-card>

                <v-card v-if="stats.hasReportData" elevation="4" color="surface" variant="elevated" class="my-2">
                    <v-card-item>
                        <div class="tiles-text">
                            <div class="spacing-10"/>
                            <div class="text-h6 mb-1">Unique Models</div>
                            <div class="text-caption text-medium-emphasis">All AI models in use</div>
                            <p class="kpi-value mt-1 text-info">{{ stats.allModels?.length || 0 }}</p>
                            <div class="text-caption text-medium-emphasis mt-1">{{ stats.allFeatures?.length || 0 }} features active</div>
                        </div>
                    </v-card-item>
                </v-card>

                <v-card v-if="!stats.hasReportData" elevation="4" color="surface" variant="elevated" class="my-2">
                    <v-card-item>
                        <div class="tiles-text">
                            <div class="spacing-10"/>
                            <div class="text-h6 mb-1">GitHub.com Chat</div>
                            <div class="text-caption text-medium-emphasis">Users with activity</div>
                            <p class="kpi-value mt-1 text-info">{{ stats.totalDotcomChatUsers }}</p>
                            <div class="text-caption text-medium-emphasis mt-1">{{ stats.totalDotcomChatModels }} models used</div>
                        </div>
                    </v-card-item>
                </v-card>

                <v-card v-if="!stats.hasReportData" elevation="4" color="surface" variant="elevated" class="my-2">
                    <v-card-item>
                        <div class="tiles-text">
                            <div class="spacing-10"/>
                            <div class="text-h6 mb-1">GitHub.com PR</div>
                            <div class="text-caption text-medium-emphasis">Users with PR summaries</div>
                            <p class="kpi-value mt-1 text-warning">{{ stats.totalDotcomPRUsers }}</p>
                            <div class="text-caption text-medium-emphasis mt-1">{{ stats.totalDotcomPRModels }} models used</div>
                        </div>
                    </v-card-item>
                </v-card>
            </div>

            <!-- Charts section -->
            <v-container :fluid="chartColumns === 'full'" :class="['elevation-2', chartColumns === 'full' ? 'px-0' : 'px-4']">
              <div class="d-flex justify-end mb-2">
                <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
                  <v-btn value="1" size="small" icon="mdi-view-agenda" title="Single column" />
                  <v-btn value="2" size="small" icon="mdi-view-grid" title="Two columns" />
                  <v-btn value="full" size="small" icon="mdi-fullscreen" title="Full width" />
                </v-btn-toggle>
              </div>

              <!-- New API: Active Users Over Time -->
              <v-row v-if="stats.hasReportData && activeUsersChartData.labels.length > 0" class="mb-4">
                <v-col cols="12">
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Active Users Over Time</v-card-title>
                    <v-card-subtitle class="px-4 pb-1"><span class="font-italic">Shaded columns = weekends</span></v-card-subtitle>
                    <v-card-text>
                      <div class="chart-container">
                        <LineChart :data="activeUsersChartData" :options="chartOptions" :plugins="[weekendPlugin, gradientFillPlugin]" />
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- New API: Model + Feature bar charts -->
              <v-row v-if="stats.hasReportData" class="mb-2">
                <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Top Models by Interactions</v-card-title>
                    <v-card-text>
                      <div style="height:220px">
                        <BarChart v-if="modelBarChartData.labels.length" :data="modelBarChartData" :options="horizBarOpts" />
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Top Features by Interactions</v-card-title>
                    <v-card-text>
                      <div style="height:220px">
                        <BarChart v-if="featureBarChartData.labels.length" :data="featureBarChartData" :options="horizBarOpts" />
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- New API: Model Usage by Feature (table) -->
              <v-row v-if="stats.hasReportData && stats.modelFeatureTable?.length > 0" class="mb-4">
                <v-col cols="12">
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Model Usage by Feature</v-card-title>
                    <v-card-text class="pa-0">
                      <v-data-table :headers="modelFeatureHeaders" :items="stats.modelFeatureTable" :sort-by="[{ key: 'locAdded', order: 'desc' }]" />
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- New API: Charts side by side -->
              <v-row v-if="stats.hasReportData && (stats.featureSummary?.length > 0 || stats.modelSummary?.length > 0)" class="mb-4">
                <v-col v-if="stats.featureSummary?.length > 0" cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
                  <v-card variant="elevated" elevation="2" class="flex-grow-1">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Lines Added by Feature</v-card-title>
                    <v-card-text>
                      <div style="height:240px">
                        <BarChart v-if="locByFeatureBarData.labels.length" :data="locByFeatureBarData" :options="horizBarOpts" />
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col v-if="stats.modelSummary?.length > 0" cols="12" :md="chartColumns === '2' ? 6 : 12" class="d-flex">
                  <v-card variant="elevated" elevation="2" class="flex-grow-1">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Lines Added by Model</v-card-title>
                    <v-card-text>
                      <div style="height:240px">
                        <BarChart v-if="locByModelBarData.labels.length" :data="locByModelBarData" :options="horizBarOpts" />
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- New API: Feature Summary table (full width) -->
              <v-row v-if="stats.hasReportData && stats.featureSummary?.length > 0" class="mb-4">
                <v-col cols="12">
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Feature Summary</v-card-title>
                    <v-card-text class="pa-0">
                      <v-data-table :headers="featureSummaryHeaders" :items="stats.featureSummary" :sort-by="[{ key: 'codeGenerations', order: 'desc' }]" density="compact" />
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- New API: Model Summary table (full width) -->
              <v-row v-if="stats.hasReportData && stats.modelSummary?.length > 0" class="mb-4">
                <v-col cols="12">
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Model Summary</v-card-title>
                    <v-card-text class="pa-0">
                      <v-data-table :headers="modelSummaryHeaders" :items="stats.modelSummary" :sort-by="[{ key: 'locAdded', order: 'desc' }]" density="compact" />
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- Legacy: Expansion panels for old API model details -->
              <v-row v-if="!stats.hasReportData" class="mb-4">
                <v-col cols="12">
                  <v-card variant="elevated" elevation="2" class="mb-4">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Models by Feature</v-card-title>
                    <v-card-text class="pa-0">
                      <v-expansion-panels>
                        <v-expansion-panel v-if="stats.ideCodeCompletionModels.length > 0">
                          <v-expansion-panel-title>
                            <v-icon start>mdi-code-braces</v-icon>
                            IDE Code Completions Models ({{ stats.ideCodeCompletionModels.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <v-data-table :headers="codeCompletionHeaders" :items="stats.ideCodeCompletionModels" />
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                        <v-expansion-panel v-if="stats.ideChatModels.length > 0">
                          <v-expansion-panel-title>
                            <v-icon start>mdi-chat</v-icon>
                            IDE Chat Models ({{ stats.ideChatModels.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <v-data-table :headers="ideChatHeaders" :items="stats.ideChatModels" />
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                        <v-expansion-panel v-if="stats.dotcomChatModels.length > 0">
                          <v-expansion-panel-title>
                            <v-icon start>mdi-web</v-icon>
                            GitHub.com Chat Models ({{ stats.dotcomChatModels.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <v-data-table :headers="dotcomChatHeaders" :items="stats.dotcomChatModels" />
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                        <v-expansion-panel v-if="stats.dotcomPRModels.length > 0">
                          <v-expansion-panel-title>
                            <v-icon start>mdi-source-pull</v-icon>
                            GitHub.com PR Summary Models ({{ stats.dotcomPRModels.length }})
                          </v-expansion-panel-title>
                          <v-expansion-panel-text>
                            <v-data-table :headers="dotcomPRHeaders" :items="stats.dotcomPRModels" />
                          </v-expansion-panel-text>
                        </v-expansion-panel>
                      </v-expansion-panels>
                    </v-card-text>
                  </v-card>

                  <!-- Model Usage Distribution -->
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Model Usage Distribution</v-card-title>
                    <v-card-text>
                      <div class="chart-container">
                        <BarChart v-if="stats.modelUsageChartData.labels.length" :data="stats.modelUsageChartData" :options="barChartOptions" />
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>

              <!-- Feature usage over time chart -->
              <v-row class="mb-4">
                <v-col cols="12">
                  <v-card variant="elevated" elevation="2">
                    <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Feature Usage Over Time</v-card-title>
                    <v-card-subtitle class="px-4 pb-1"><span class="font-italic">Shaded columns = weekends</span></v-card-subtitle>
                    <v-card-text>
                      <div class="chart-container">
                        <LineChart v-if="stats.agentModeChartData.labels.length" :data="stats.agentModeChartData" :options="chartOptions" :plugins="[weekendPlugin, gradientFillPlugin]" />
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
              <!-- Premium requests info card -->
              <v-row class="mb-2">
                <v-col cols="12">
                  <v-alert variant="tonal" color="info" icon="mdi-information-outline" density="compact">
                    <div class="text-body-2">
                      <strong>Premium requests</strong> — some models consume multiple Copilot request units (e.g. Claude Opus 4.7 = 7.5×, GPT-5.4 mini = 0.25×).
                      This dashboard shows request counts; to view quota usage and estimated costs, check your
                      <a :href="billingUrl" target="_blank" rel="noopener" class="text-primary">billing settings</a>
                      or the
                      <a href="https://docs.github.com/en/copilot/concepts/billing/copilot-requests#model-multipliers" target="_blank" rel="noopener" class="text-primary">model multipliers docs</a>.
                    </div>
                  </v-alert>
                </v-col>
              </v-row>
            </v-container>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, computed, type PropType, shallowRef } from 'vue';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import { Options } from '@/model/Options';
import { useRoute } from 'vue-router';
import { Line as LineChart, Bar as BarChart } from 'vue-chartjs';
import {
    Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend
} from 'chart.js';

import { PALETTE, weekendPlugin, gradientFillPlugin, makeLineOptions } from '@/utils/chartPlugins';

import { Filler } from 'chart.js';
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler);

interface ModelData {
    name: string;
    editor?: string;
    repository?: string;
    model_type: string;
    total_engaged_users: number;
    total_chats?: number;
    total_chat_insertion_events?: number;
    total_chat_copy_events?: number;
    total_pr_summaries_created?: number;
}

interface ChartData {
    labels: string[];
    datasets: Array<{
        label: string;
        data: number[];
        borderColor?: string;
        backgroundColor?: string;
        fill?: boolean;
    }>;
}

interface GitHubStats {
    totalIdeCodeCompletionUsers: number;
    totalIdeChatUsers: number;
    totalDotcomChatUsers: number;
    totalDotcomPRUsers: number;
    totalPRSummariesCreated: number;
    totalIdeCodeCompletionModels: number;
    totalIdeChatModels: number;
    totalDotcomChatModels: number;
    totalDotcomPRModels: number;
    ideCodeCompletionModels: ModelData[];
    ideChatModels: ModelData[];
    dotcomChatModels: ModelData[];
    dotcomPRModels: ModelData[];
    agentModeChartData: ChartData;
    modelUsageChartData: ChartData;
    // New API data
    hasReportData: boolean;
    allModels: string[];
    allFeatures: string[];
    modelFeatureTable: any[];
    featureSummary: any[];
    modelSummary: any[];
    dailyActiveUsers: { day: string; daily: number; weekly: number; monthly: number }[];
    agentUsers: { day: string; monthlyAgentUsers: number; monthlyChatUsers: number }[];
}

const defaultStats: GitHubStats = {
    totalIdeCodeCompletionUsers: 0,
    totalIdeChatUsers: 0,
    totalDotcomChatUsers: 0,
    totalDotcomPRUsers: 0,
    totalPRSummariesCreated: 0,
    totalIdeCodeCompletionModels: 0,
    totalIdeChatModels: 0,
    totalDotcomChatModels: 0,
    totalDotcomPRModels: 0,
    ideCodeCompletionModels: [],
    ideChatModels: [],
    dotcomChatModels: [],
    dotcomPRModels: [],
    agentModeChartData: { labels: [], datasets: [] },
    modelUsageChartData: { labels: [], datasets: [] },
    hasReportData: false,
    allModels: [],
    allFeatures: [],
    modelFeatureTable: [],
    featureSummary: [],
    modelSummary: [],
    dailyActiveUsers: [],
    agentUsers: [],
};

interface DateRange {
    since?: string;
    until?: string;
}

export default defineComponent({
    name: 'AgentModeViewer',
    components: { LineChart, BarChart },
    props: {
        dateRange: { type: Object as PropType<DateRange>, required: true },
        originalMetrics: { type: Array as PropType<CopilotMetrics[]>, required: true },
        dateRangeDescription: { type: String, default: '' }
    },
    setup(props) {
        const stats = shallowRef<GitHubStats>({ ...defaultStats });
        const loading = ref(false);
        const error = ref<string | null>(null);
        const route = useRoute();
        const lastMetricsHash = ref<string>('');
        const lastDateRange = ref<string>('');

        let fetchTimeout: ReturnType<typeof setTimeout> | null = null;
        const fetchStats = async () => {
            if (props.originalMetrics.length === 0) return;

            const currentHash = JSON.stringify(props.originalMetrics.map(m => ({
                date: m.date, activeUsers: m.total_active_users, engagedUsers: m.total_engaged_users
            })));
            const currentDateRange = props.dateRangeDescription || '';
            if (currentHash === lastMetricsHash.value && currentDateRange === lastDateRange.value) return;

            if (fetchTimeout) clearTimeout(fetchTimeout);

            fetchTimeout = setTimeout(async () => {
                loading.value = true;
                error.value = null;
                try {
                    const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until);
                    const params = options.toParams();
                    const queryString = new URLSearchParams(params).toString();
                    const apiUrl = queryString ? `/api/github-stats?${queryString}` : '/api/github-stats';
                    const response = await $fetch(apiUrl) as GitHubStats;
                    stats.value = { ...defaultStats, ...response };
                    lastMetricsHash.value = currentHash;
                    lastDateRange.value = currentDateRange;
                } catch (err: unknown) {
                    error.value = err instanceof Error ? err.message : 'Failed to fetch GitHub statistics';
                    console.error('Error fetching GitHub stats:', err);
                } finally {
                    loading.value = false;
                }
            }, 150);
        };

        watch(() => [props.originalMetrics, props.dateRangeDescription, props.dateRange], fetchStats, { immediate: true, deep: false });

        // Active Users chart from reportData
        const activeUsersChartData = computed(() => {
            const users = stats.value.dailyActiveUsers || [];
            if (users.length === 0) return { labels: [], datasets: [] };
            return {
                labels: users.map(u => u.day),
                datasets: [
                    {
                        label: 'Daily Active Users', data: users.map(u => u.daily),
                        borderColor: 'rgb(75, 192, 192)', backgroundColor: 'rgba(75, 192, 192, 0.2)', tension: 0.1
                    },
                    {
                        label: 'Monthly Active Users', data: users.map(u => u.monthly),
                        borderColor: 'rgb(153, 102, 255)', backgroundColor: 'rgba(153, 102, 255, 0.2)', tension: 0.1
                    },
                ]
            };
        });

        // Table headers
        const modelFeatureHeaders = [
            { title: 'Model', key: 'model' },
            { title: 'Feature', key: 'feature' },
            { title: 'Interactions', key: 'interactions' },
            { title: 'Code Generations', key: 'codeGenerations' },
            { title: 'Lines Added', key: 'locAdded' },
            { title: 'Lines Deleted', key: 'locDeleted' },
        ];
        const featureSummaryHeaders = [
            { title: 'Feature', key: 'feature' },
            { title: 'Interactions', key: 'interactions' },
            { title: 'Code Generations', key: 'codeGenerations' },
            { title: 'Lines Added', key: 'locAdded' },
        ];
        const modelSummaryHeaders = [
            { title: 'Model', key: 'model' },
            { title: 'Interactions', key: 'interactions' },
            { title: 'Code Generations', key: 'codeGenerations' },
            { title: 'Lines Added', key: 'locAdded' },
        ];
        const codeCompletionHeaders = [
            { title: 'Model Name', key: 'name' }, { title: 'Editor', key: 'editor' },
            { title: 'Type', key: 'model_type' }, { title: 'Total Users', key: 'total_engaged_users' }
        ];
        const ideChatHeaders = [
            { title: 'Model Name', key: 'name' }, { title: 'Editor', key: 'editor' },
            { title: 'Type', key: 'model_type' }, { title: 'Total Users', key: 'total_engaged_users' },
            { title: 'Total Chats', key: 'total_chats' }, { title: 'Insertions', key: 'total_chat_insertion_events' },
            { title: 'Copy Events', key: 'total_chat_copy_events' }
        ];
        const dotcomChatHeaders = [
            { title: 'Model Name', key: 'name' }, { title: 'Type', key: 'model_type' },
            { title: 'Total Users', key: 'total_engaged_users' }, { title: 'Total Chats', key: 'total_chats' }
        ];
        const dotcomPRHeaders = [
            { title: 'Model Name', key: 'name' }, { title: 'Repository', key: 'repository' },
            { title: 'Type', key: 'model_type' }, { title: 'Total Users', key: 'total_engaged_users' },
            { title: 'PR Summaries', key: 'total_pr_summaries_created' }
        ];

        const chartOptions = makeLineOptions({
            animation: { duration: 0 },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Users' } } },
        });
        const barChartOptions = {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Models' } } },
            plugins: { legend: { display: true, position: 'top' as const } },
            interaction: { intersect: false }
        };

        // Bar charts for model and feature summaries
        const modelBarChartData = computed(() => {
            const rows = (stats.value.modelSummary || []).slice(0, 10).sort((a: any, b: any) => b.interactions - a.interactions);
            return {
                labels: rows.map((r: any) => r.model),
                datasets: [{ label: 'Interactions', data: rows.map((r: any) => r.interactions), backgroundColor: PALETTE.slice(0, rows.length).map(p => p.bg), borderColor: PALETTE.slice(0, rows.length).map(p => p.border), borderWidth: 1 }]
            };
        });
        const featureBarChartData = computed(() => {
            const rows = (stats.value.featureSummary || []).slice(0, 10).sort((a: any, b: any) => b.interactions - a.interactions);
            return {
                labels: rows.map((r: any) => r.feature),
                datasets: [{ label: 'Interactions', data: rows.map((r: any) => r.interactions), backgroundColor: PALETTE.slice(0, rows.length).map(p => p.bg), borderColor: PALETTE.slice(0, rows.length).map(p => p.border), borderWidth: 1 }]
            };
        });
        const horizBarOpts = { responsive: true, maintainAspectRatio: false, indexAxis: 'y' as const, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true } } };

        const locByFeatureBarData = computed(() => {
            const rows = (stats.value.featureSummary || []).filter((r: any) => r.locAdded > 0).sort((a: any, b: any) => b.locAdded - a.locAdded).slice(0, 10);
            return {
                labels: rows.map((r: any) => r.feature),
                datasets: [{ label: 'Lines Added', data: rows.map((r: any) => r.locAdded), backgroundColor: PALETTE.slice(0, rows.length).map(p => p.bg), borderColor: PALETTE.slice(0, rows.length).map(p => p.border), borderWidth: 1 }]
            };
        });
        const locByModelBarData = computed(() => {
            const rows = (stats.value.modelSummary || []).filter((r: any) => r.locAdded > 0).sort((a: any, b: any) => b.locAdded - a.locAdded).slice(0, 10);
            return {
                labels: rows.map((r: any) => r.model),
                datasets: [{ label: 'Lines Added', data: rows.map((r: any) => r.locAdded), backgroundColor: PALETTE.slice(0, rows.length).map(p => p.bg), borderColor: PALETTE.slice(0, rows.length).map(p => p.border), borderWidth: 1 }]
            };
        });

        const billingUrl = computed(() => {
            const org = route.params.org as string;
            const ent = route.params.ent as string;
            if (ent) return `https://github.com/enterprises/${ent}/settings/billing/copilot`;
            if (org) return `https://github.com/organizations/${org}/settings/billing/copilot`;
            return 'https://github.com/settings/billing/copilot';
        });

        return {
            stats, loading, error, activeUsersChartData,
            modelBarChartData, featureBarChartData, locByFeatureBarData, locByModelBarData, horizBarOpts,
            modelFeatureHeaders, featureSummaryHeaders, modelSummaryHeaders,
            codeCompletionHeaders, ideChatHeaders, dotcomChatHeaders, dotcomPRHeaders,
            chartOptions, barChartOptions,
            weekendPlugin, gradientFillPlugin,
            billingUrl,
        };
    },
    data() {
        return { chartColumns: '2' };
    },
});
</script>

<style scoped>
.chart-container { height: 400px; width: 100%; position: relative; }
</style>

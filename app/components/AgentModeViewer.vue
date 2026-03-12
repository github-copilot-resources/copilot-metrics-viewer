<template>
    <div class="github-com-container">
        <v-main class="p-1" style="min-height: 300px;">
            <v-container style="min-height: 300px;" class="px-4 elevation-2">
                <!-- Loading state -->
                <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 300px;">
                    <v-progress-circular indeterminate size="64" color="primary" />
                </div>

                <!-- Error state -->
                <div v-else-if="error" class="d-flex justify-center align-center" style="min-height: 300px;">
                    <v-alert type="error" class="mb-4">
                        <v-alert-title>Error Loading Statistics</v-alert-title>
                        {{ error }}
                    </v-alert>
                </div>

                <!-- Main content -->
                <div v-else>
                    <h2 class="mb-4">Copilot Statistics</h2>

                    <!-- Date Range -->
                    <v-card v-if="dateRangeDescription" flat class="pa-3 mb-4" color="blue-grey lighten-5">
                        <div class="text-body-2 text-center">
                            <v-icon left small>mdi-calendar-range</v-icon>
                            {{ dateRangeDescription }}
                        </div>
                    </v-card>

                    <!-- Overview Cards -->
                    <v-row class="mb-4">
                        <v-col cols="12" md="6" lg="3">
                            <v-card elevation="4" color="blue lighten-4">
                                <v-card-title class="text-h6">Code Completions</v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalIdeCodeCompletionUsers }}</div>
                                    <div class="text-caption">Total Users with Activity</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalIdeCodeCompletionModels }} Models Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col cols="12" md="6" lg="3">
                            <v-card elevation="4" color="green lighten-4">
                                <v-card-title class="text-h6">Chat</v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalIdeChatUsers }}</div>
                                    <div class="text-caption">Total Users with Activity</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalIdeChatModels }} Models Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col v-if="stats.hasReportData" cols="12" md="6" lg="3">
                            <v-card elevation="4" color="purple lighten-4">
                                <v-card-title class="text-h6">All Models</v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.allModels?.length || 0 }}</div>
                                    <div class="text-caption">Unique AI Models Used</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.allFeatures?.length || 0 }} Features Active</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col v-if="!stats.hasReportData" cols="12" md="6" lg="3">
                            <v-card elevation="4" color="purple lighten-4">
                                <v-card-title class="text-h6">GitHub.com Chat</v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalDotcomChatUsers }}</div>
                                    <div class="text-caption">Total Users with Activity</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalDotcomChatModels }} Models Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col v-if="!stats.hasReportData" cols="12" md="6" lg="3">
                            <v-card elevation="4" color="orange lighten-4">
                                <v-card-title class="text-h6">GitHub.com PR</v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalDotcomPRUsers }}</div>
                                    <div class="text-caption">Total Users with Activity</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalDotcomPRModels }} Models Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                    </v-row>

                    <!-- New API: Active Users Over Time -->
                    <div v-if="stats.hasReportData && activeUsersChartData.labels.length > 0" class="mb-6">
                        <h2 class="mb-1">Active Users Over Time</h2>
                        <div class="chart-container">
                            <LineChart :data="activeUsersChartData" :options="chartOptions" />
                        </div>
                    </div>

                    <!-- New API: Model Usage by Feature (table) -->
                    <div v-if="stats.hasReportData && stats.modelFeatureTable?.length > 0" class="mb-6">
                        <h2 class="mb-4">Model Usage by Feature</h2>
                        <v-data-table
                            :headers="modelFeatureHeaders"
                            :items="stats.modelFeatureTable"
                            class="elevation-2"
                            :sort-by="[{ key: 'locAdded', order: 'desc' }]"
                        />
                    </div>

                    <!-- New API: Feature Summary -->
                    <div v-if="stats.hasReportData && stats.featureSummary?.length > 0" class="mb-6">
                        <h2 class="mb-4">Feature Summary</h2>
                        <v-data-table
                            :headers="featureSummaryHeaders"
                            :items="stats.featureSummary"
                            class="elevation-2"
                            :sort-by="[{ key: 'codeGenerations', order: 'desc' }]"
                        />
                    </div>

                    <!-- New API: Model Summary -->
                    <div v-if="stats.hasReportData && stats.modelSummary?.length > 0" class="mb-6">
                        <h2 class="mb-4">Model Summary</h2>
                        <v-data-table
                            :headers="modelSummaryHeaders"
                            :items="stats.modelSummary"
                            class="elevation-2"
                            :sort-by="[{ key: 'locAdded', order: 'desc' }]"
                        />
                    </div>

                    <!-- Legacy: Expansion panels for old API model details -->
                    <div v-if="!stats.hasReportData">
                        <h2 class="mb-4">Models by Feature</h2>
                        <v-expansion-panels class="mb-4">
                            <v-expansion-panel v-if="stats.ideCodeCompletionModels.length > 0">
                                <v-expansion-panel-title>
                                    <v-icon start>mdi-code-braces</v-icon>
                                    IDE Code Completions Models ({{ stats.ideCodeCompletionModels.length }})
                                </v-expansion-panel-title>
                                <v-expansion-panel-text>
                                    <v-data-table :headers="codeCompletionHeaders" :items="stats.ideCodeCompletionModels" class="elevation-1" />
                                </v-expansion-panel-text>
                            </v-expansion-panel>

                            <v-expansion-panel v-if="stats.ideChatModels.length > 0">
                                <v-expansion-panel-title>
                                    <v-icon start>mdi-chat</v-icon>
                                    IDE Chat Models ({{ stats.ideChatModels.length }})
                                </v-expansion-panel-title>
                                <v-expansion-panel-text>
                                    <v-data-table :headers="ideChatHeaders" :items="stats.ideChatModels" class="elevation-1" />
                                </v-expansion-panel-text>
                            </v-expansion-panel>

                            <v-expansion-panel v-if="stats.dotcomChatModels.length > 0">
                                <v-expansion-panel-title>
                                    <v-icon start>mdi-web</v-icon>
                                    GitHub.com Chat Models ({{ stats.dotcomChatModels.length }})
                                </v-expansion-panel-title>
                                <v-expansion-panel-text>
                                    <v-data-table :headers="dotcomChatHeaders" :items="stats.dotcomChatModels" class="elevation-1" />
                                </v-expansion-panel-text>
                            </v-expansion-panel>

                            <v-expansion-panel v-if="stats.dotcomPRModels.length > 0">
                                <v-expansion-panel-title>
                                    <v-icon start>mdi-source-pull</v-icon>
                                    GitHub.com PR Summary Models ({{ stats.dotcomPRModels.length }})
                                </v-expansion-panel-title>
                                <v-expansion-panel-text>
                                    <v-data-table :headers="dotcomPRHeaders" :items="stats.dotcomPRModels" class="elevation-1" />
                                </v-expansion-panel-text>
                            </v-expansion-panel>
                        </v-expansion-panels>

                        <h2 class="mb-1">Model Usage Distribution</h2>
                        <div class="chart-container">
                            <BarChart v-if="stats.modelUsageChartData.labels.length" :data="stats.modelUsageChartData" :options="barChartOptions" />
                        </div>
                    </div>

                    <!-- Feature usage over time chart -->
                    <h2 class="mb-1">Feature Usage Over Time</h2>
                    <div class="chart-container">
                        <LineChart v-if="stats.agentModeChartData.labels.length" :data="stats.agentModeChartData" :options="chartOptions" />
                    </div>
                </div>
            </v-container>
        </v-main>
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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend);

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

        const chartOptions = {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Users' } } },
            plugins: { legend: { display: true, position: 'top' as const } },
            interaction: { intersect: false }
        };
        const barChartOptions = {
            responsive: true, maintainAspectRatio: false,
            animation: { duration: 0 },
            scales: { y: { beginAtZero: true, title: { display: true, text: 'Number of Models' } } },
            plugins: { legend: { display: true, position: 'top' as const } },
            interaction: { intersect: false }
        };

        return {
            stats, loading, error, activeUsersChartData,
            modelFeatureHeaders, featureSummaryHeaders, modelSummaryHeaders,
            codeCompletionHeaders, ideChatHeaders, dotcomChatHeaders, dotcomPRHeaders,
            chartOptions, barChartOptions
        };
    }
});
</script>

<style scoped>
.github-com-container { padding: 16px; }
.v-card { margin-bottom: 16px; }
.v-expansion-panel { margin-bottom: 8px; }
.v-data-table { margin-top: 16px; }
.chart-container { height: 400px; width: 100%; position: relative; }
</style>

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
                    <!-- Agent Mode Statistics Title -->
                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                        <template #activator="{ props }">
                            <h2 v-bind="props" class="mb-4">Copilot Statistics</h2>
                        </template>
                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 400px;">
                            <span class="text-caption" style="font-size: 10px !important;">
                                This section displays statistics for different GitHub.com Copilot features and the
                                models used by users.
                            </span>
                        </v-card>
                    </v-tooltip>

                    <!-- Date Range Information -->
                    <v-card v-if="dateRangeDescription" flat class="pa-3 mb-4" color="blue-grey lighten-5">
                        <div class="text-body-2 text-center">
                            <v-icon left small>mdi-calendar-range</v-icon>
                            {{ dateRangeDescription }}
                        </div>
                    </v-card>

                    <!-- Agent Mode Overview Cards -->
                    <v-row class="mb-4">
                        <v-col cols="12" md="6" lg="3">
                            <v-card elevation="4" color="blue lighten-4">
                                <v-card-title class="text-h6">
                                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                                        <template #activator="{ props }">
                                            <span v-bind="props">IDE Code Completions</span>
                                        </template>
                                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                                            <span class="text-caption" style="font-size: 10px !important;">
                                                Statistics for code completions in integrated development environments.
                                            </span>
                                        </v-card>
                                    </v-tooltip>
                                </v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalIdeCodeCompletionUsers }}</div>
                                    <div class="text-caption">Total Users with Activity</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalIdeCodeCompletionModels }} Models
                                        Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col cols="12" md="6" lg="3">
                            <v-card elevation="4" color="green lighten-4">
                                <v-card-title class="text-h6">
                                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                                        <template #activator="{ props }">
                                            <span v-bind="props">IDE Chat</span>
                                        </template>
                                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                                            <span class="text-caption" style="font-size: 10px !important;">
                                                Statistics for chat interactions in integrated development environments.
                                            </span>
                                        </v-card>
                                    </v-tooltip>
                                </v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalIdeChatUsers }}</div>
                                    <div class="text-caption">Total Users with Activity</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalIdeChatModels }} Models Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col cols="12" md="6" lg="3">
                            <v-card elevation="4" color="purple lighten-4">
                                <v-card-title class="text-h6">
                                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                                        <template #activator="{ props }">
                                            <span v-bind="props">GitHub.com Chat</span>
                                        </template>
                                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                                            <span class="text-caption" style="font-size: 10px !important;">
                                                Statistics for chat interactions on GitHub.com web interface.
                                            </span>
                                        </v-card>
                                    </v-tooltip>
                                </v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalDotcomChatUsers }}</div>
                                    <div class="text-caption">Total Users with Activity</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalDotcomChatModels }} Models Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                        <v-col cols="12" md="6" lg="3">
                            <v-card elevation="4" color="orange lighten-4">
                                <v-card-title class="text-h6">
                                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                                        <template #activator="{ props }">
                                            <span v-bind="props">GitHub.com PR Summaries</span>
                                        </template>
                                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                                            <span class="text-caption" style="font-size: 10px !important;">
                                                Statistics for pull request summaries generated by Copilot on
                                                GitHub.com.
                                            </span>
                                        </v-card>
                                    </v-tooltip>
                                </v-card-title>
                                <v-card-text>
                                    <div class="text-h4 mb-2">{{ stats.totalPRSummariesCreated }}</div>
                                    <div class="text-caption">Total PR Summaries Created</div>
                                    <div class="text-subtitle2 mt-2">{{ stats.totalDotcomPRModels }} Models Used</div>
                                </v-card-text>
                            </v-card>
                        </v-col>
                    </v-row>

                    <!-- Agent Mode Statistics Chart -->
                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                        <template #activator="{ props }">
                            <h2 v-bind="props" class="mb-1">Copilot Feature Usage Over Time</h2>
                        </template>
                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 400px;">
                            <span class="text-caption" style="font-size: 10px !important;">
                                This chart shows the usage of different Copilot features over time.
                            </span>
                        </v-card>
                    </v-tooltip>
                    <div class="chart-container">
                        <LineChart
v-if="stats.agentModeChartData.labels.length" :data="stats.agentModeChartData"
                            :options="chartOptions" />
                    </div>

                    <!-- Models Used Section -->
                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                        <template #activator="{ props }">
                            <h2 v-bind="props" class="mb-4 mt-6">Models Used by Users</h2>
                        </template>
                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 400px;">
                            <span class="text-caption" style="font-size: 10px !important;">
                                This section shows detailed information about the AI models used across different
                                GitHub.com Copilot
                                features.
                            </span>
                        </v-card>
                    </v-tooltip>

                    <!-- Models by Agent Mode -->
                    <v-expansion-panels class="mb-4">
                        <v-expansion-panel v-if="stats.ideCodeCompletionModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-code-braces</v-icon>
                                IDE Code Completions Models ({{ stats.ideCodeCompletionModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table
:headers="codeCompletionHeaders" :items="stats.ideCodeCompletionModels"
                                    class="elevation-1" item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="stats.ideChatModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-chat</v-icon>
                                IDE Chat Models ({{ stats.ideChatModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table
:headers="ideChatHeaders" :items="stats.ideChatModels" class="elevation-1"
                                    item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="stats.dotcomChatModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-web</v-icon>
                                GitHub.com Chat Models ({{ stats.dotcomChatModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table
:headers="dotcomChatHeaders" :items="stats.dotcomChatModels"
                                    class="elevation-1" item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="stats.dotcomPRModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-source-pull</v-icon>
                                GitHub.com PR Summary Models ({{ stats.dotcomPRModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table
:headers="dotcomPRHeaders" :items="stats.dotcomPRModels"
                                    class="elevation-1" item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>

                    <!-- Model Usage Summary Chart -->
                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                        <template #activator="{ props }">
                            <h2 v-bind="props" class="mb-1">Model Usage Distribution</h2>
                        </template>
                        <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 400px;">
                            <span class="text-caption" style="font-size: 10px !important;">
                                This chart shows the distribution of model usage across different GitHub.com Copilot
                                features.
                            </span>
                        </v-card>
                    </v-tooltip>
                    <div class="chart-container">
                        <BarChart
v-if="stats.modelUsageChartData.labels.length" :data="stats.modelUsageChartData"
                            :options="barChartOptions" />
                    </div>
                </div>
            </v-container>
        </v-main>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, type PropType, shallowRef } from 'vue';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import { Options } from '@/model/Options';
import { useRoute } from 'vue-router';
import { Line as LineChart, Bar as BarChart } from 'vue-chartjs';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
} from 'chart.js';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Title,
    Tooltip,
    Legend
);

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
    modelUsageChartData: { labels: [], datasets: [] }
};

interface DateRange {
    since?: string;
    until?: string;
}

export default defineComponent({
    name: 'AgentModeViewer',
    components: {
        LineChart,
        BarChart
    },
    props: {
        dateRange: {
            type: Object as PropType<DateRange>,
            required: true
        },
        originalMetrics: {
            type: Array as PropType<CopilotMetrics[]>,
            required: true
        },
        dateRangeDescription: {
            type: String,
            default: ''
        }
    },
    setup(props) {
        // Use shallowRef for better performance with large objects
        const stats = shallowRef<GitHubStats>({ ...defaultStats });
        const loading = ref(false);
        const error = ref<string | null>(null);
        const route = useRoute();

        // Cache to prevent unnecessary API calls
        const lastMetricsHash = ref<string>('');
        const lastDateRange = ref<string>('');

        // Optimized fetch function with caching and debouncing
        let fetchTimeout: ReturnType<typeof setTimeout> | null = null;
        const fetchStats = async () => {
            if (props.originalMetrics.length === 0) return;

            // Create a simple hash of the metrics to detect changes
            const currentHash = JSON.stringify(props.originalMetrics.map(m => ({
                date: m.date,
                activeUsers: m.total_active_users,
                engagedUsers: m.total_engaged_users
            })));
            const currentDateRange = props.dateRangeDescription || '';

            if (currentHash === lastMetricsHash.value && currentDateRange === lastDateRange.value) return;

            if (fetchTimeout) {
                clearTimeout(fetchTimeout);
            }

            fetchTimeout = setTimeout(async () => {
                loading.value = true;
                error.value = null;

                try {
                    // Extract date range from props.originalMetrics if available
                    const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until);
                    const params = options.toParams();
                    const queryString = new URLSearchParams(params).toString();
                    const apiUrl = queryString ? `/api/github-stats?${queryString}` : '/api/github-stats';

                    const response = await $fetch(apiUrl) as GitHubStats;
                    // Use Object.assign to maintain reactivity while updating properties
                    Object.assign(stats.value, response);
                    lastMetricsHash.value = currentHash;
                    lastDateRange.value = currentDateRange;
                } catch (err: unknown) {
                    error.value = err instanceof Error ? err.message : 'Failed to fetch GitHub statistics';
                    console.error('Error fetching GitHub stats:', err);
                } finally {
                    loading.value = false;
                }
            }, 150); // Reduced debounce time for better responsiveness
        };

        // Watch for changes with improved performance
        watch(() => [props.originalMetrics, props.dateRangeDescription, props.dateRange], fetchStats, { immediate: true, deep: false });

        // Static table headers (avoid recreating on every render)
        const codeCompletionHeaders = [
            { title: 'Model Name', key: 'name' },
            { title: 'Editor', key: 'editor' },
            { title: 'Type', key: 'model_type' },
            { title: 'Total Users with Activity', key: 'total_engaged_users' }
        ];

        const ideChatHeaders = [
            { title: 'Model Name', key: 'name' },
            { title: 'Editor', key: 'editor' },
            { title: 'Type', key: 'model_type' },
            { title: 'Total Users with Activity', key: 'total_engaged_users' },
            { title: 'Total Chats', key: 'total_chats' },
            { title: 'Insertions', key: 'total_chat_insertion_events' },
            { title: 'Copy Events', key: 'total_chat_copy_events' }
        ];

        const dotcomChatHeaders = [
            { title: 'Model Name', key: 'name' },
            { title: 'Type', key: 'model_type' },
            { title: 'Total Users with Activity', key: 'total_engaged_users' },
            { title: 'Total Chats', key: 'total_chats' }
        ];

        const dotcomPRHeaders = [
            { title: 'Model Name', key: 'name' },
            { title: 'Repository', key: 'repository' },
            { title: 'Type', key: 'model_type' },
            { title: 'Total Users with Activity', key: 'total_engaged_users' },
            { title: 'PR Summaries', key: 'total_pr_summaries_created' }
        ];

        // Optimized chart options with performance settings
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Disable animations for better performance
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Users with Activity'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Copilot Feature Usage Over Time'
                },
                legend: {
                    display: true,
                    position: 'top' as const
                }
            },
            interaction: {
                intersect: false
            }
        };

        const barChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
            animation: {
                duration: 0 // Disable animations for better performance
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Models'
                    }
                }
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Model Usage Distribution'
                },
                legend: {
                    display: true,
                    position: 'top' as const
                }
            },
            interaction: {
                intersect: false
            }
        };

        return {
            stats,
            loading,
            error,
            codeCompletionHeaders,
            ideChatHeaders,
            dotcomChatHeaders,
            dotcomPRHeaders,
            chartOptions,
            barChartOptions
        };
    }
});
</script>

<style scoped>
.github-com-container {
    padding: 16px;
}

.v-card {
    margin-bottom: 16px;
}

.v-expansion-panel {
    margin-bottom: 8px;
}

.v-data-table {
    margin-top: 16px;
}

/* Optimize chart rendering */
.chart-container {
    height: 400px;
    width: 100%;
    position: relative;
}
</style>
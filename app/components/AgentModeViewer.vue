<template>
    <div class="github-com-container">
        <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 300px;">
            <v-progress-circular indeterminate size="64" color="primary" />
        </div>

        <div v-else-if="error" class="d-flex justify-center align-center" style="min-height: 300px;">
            <v-alert type="error" class="mb-4">
                <v-alert-title>Error Loading Statistics</v-alert-title>
                {{ error }}
            </v-alert>
        </div>

        <div v-else>
            <!-- Agent Mode Overview Cards -->
            <div class="tiles-container">
                <MetricCard
                    title="IDE Code Completions"
                    :value="stats.totalIdeCodeCompletionUsers.toString()"
                    description="Total Users with Activity"
                    icon="mdi-code-braces"
                    color="primary"
                    :is-dark-theme="isDarkTheme"
                />
                
                <MetricCard
                    title="IDE Chat"
                    :value="stats.totalIdeChatUsers.toString()"
                    description="Total Users with Activity"
                    icon="mdi-chat"
                    color="success"
                    :is-dark-theme="isDarkTheme"
                />
                
                <MetricCard
                    title="GitHub.com Chat"
                    :value="stats.totalDotcomChatUsers.toString()"
                    description="Total Users with Activity"
                    icon="mdi-web"
                    color="info"
                    :is-dark-theme="isDarkTheme"
                />
                
                <MetricCard
                    title="GitHub.com PR Summaries"
                    :value="stats.totalPRSummariesCreated.toString()"
                    description="Total PR Summaries Created"
                    icon="mdi-source-pull"
                    color="accent"
                    :is-dark-theme="isDarkTheme"
                />
            </div>
            
            <v-main class="p-1" style="min-height: 300px;">
                <v-container style="min-height: 300px;" class="px-4 elevation-2 chart-container">

                    <!-- Agent Mode Statistics Chart -->
                    <h2 class="chart-title">Copilot Feature Usage Over Time</h2>
                    <div class="chart-wrapper">
                        <LineChart v-if="stats.agentModeChartData.labels.length" :data="stats.agentModeChartData"
                            :options="chartOptions" />
                    </div>

                    <!-- Models Used Section -->
                    <h2 class="chart-title">Models Used by Users</h2>

                    <!-- Models by Agent Mode -->
                    <v-expansion-panels class="mb-4">
                        <v-expansion-panel v-if="stats.ideCodeCompletionModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-code-braces</v-icon>
                                IDE Code Completions Models ({{ stats.ideCodeCompletionModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table :headers="codeCompletionHeaders" :items="stats.ideCodeCompletionModels"
                                    class="elevation-1" item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="stats.ideChatModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-chat</v-icon>
                                IDE Chat Models ({{ stats.ideChatModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table :headers="ideChatHeaders" :items="stats.ideChatModels" class="elevation-1"
                                    item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="stats.dotcomChatModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-web</v-icon>
                                GitHub.com Chat Models ({{ stats.dotcomChatModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table :headers="dotcomChatHeaders" :items="stats.dotcomChatModels"
                                    class="elevation-1" item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>

                        <v-expansion-panel v-if="stats.dotcomPRModels.length > 0">
                            <v-expansion-panel-title>
                                <v-icon start>mdi-source-pull</v-icon>
                                GitHub.com PR Summary Models ({{ stats.dotcomPRModels.length }})
                            </v-expansion-panel-title>
                            <v-expansion-panel-text>
                                <v-data-table :headers="dotcomPRHeaders" :items="stats.dotcomPRModels"
                                    class="elevation-1" item-key="name" />
                            </v-expansion-panel-text>
                        </v-expansion-panel>
                    </v-expansion-panels>

                    <!-- Model Usage Summary Chart -->
                    <h2 class="chart-title">Model Usage Distribution</h2>
                    <div class="chart-wrapper">
                        <BarChart v-if="stats.modelUsageChartData.labels.length" :data="stats.modelUsageChartData"
                            :options="barChartOptions" />
                    </div>
                </v-container>
            </v-main>
        </div>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, type PropType, shallowRef } from 'vue';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import { Options } from '@/model/Options';
import { useRoute } from 'vue-router';
import { Line as LineChart, Bar as BarChart } from 'vue-chartjs';
import MetricCard from './MetricCard.vue';
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
        },
        isDarkTheme: {
            type: Boolean,
            default: false
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

.chart-title {
  color: #8BE9FD;
  font-weight: 700;
  font-size: 1.5rem;
  margin: 16px 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  position: relative;
  z-index: 2;
}

.chart-container {
  background-color: rgba(18, 18, 18, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
}

.chart-wrapper {
  margin-bottom: 32px;
  position: relative;
  height: 400px;
}

.v-expansion-panel {
  margin-bottom: 8px;
  background-color: rgba(18, 18, 18, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

:deep(.v-expansion-panel-title) {
  color: #8BE9FD !important;
}

:deep(.v-data-table) {
  background-color: rgba(18, 18, 18, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  overflow: hidden;
}

:deep(.v-data-table__thead) {
  background-color: rgba(100, 216, 203, 0.1) !important;
}

:deep(.v-data-table__thead th) {
  color: #8BE9FD !important;
  font-weight: 600 !important;
  font-size: 0.8rem !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

:deep(.v-data-table__tbody tr) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

:deep(.v-data-table__tbody td) {
  color: #F8F8F2 !important;
  padding: 12px 16px;
}

:deep(.v-data-table__tbody tr:hover) {
  background-color: rgba(100, 216, 203, 0.05) !important;
}

:deep(.chartjs-render-monitor) {
  filter: drop-shadow(0 0 8px rgba(100, 216, 203, 0.2));
}
</style>
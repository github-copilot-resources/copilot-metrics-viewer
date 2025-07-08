<template>
    <div class="github-com-container">
        <v-main class="p-1" style="min-height: 300px;">
            <v-container style="min-height: 300px;" class="px-4 elevation-2">
                <!-- Loading state -->
                <div v-if="loading" class="d-flex justify-center align-center" style="min-height: 300px;">
                    <v-progress-circular indeterminate size="64" color="primary"></v-progress-circular>
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
                        <h2 v-bind="props" class="mb-4">GitHub.com Statistics</h2>
                    </template>
                    <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 400px;">
                        <span class="text-caption" style="font-size: 10px !important;">
                            This section displays statistics for different GitHub.com Copilot features and the models used by users.
                        </span>
                    </v-card>
                </v-tooltip>

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
                                <div class="text-h4 mb-2">{{ totalIdeCodeCompletionUsers }}</div>
                                <div class="text-caption">Total Users with Activity</div>
                                <div class="text-subtitle2 mt-2">{{ totalIdeCodeCompletionModels }} Models Used</div>
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
                                <div class="text-h4 mb-2">{{ totalIdeChatUsers }}</div>
                                <div class="text-caption">Total Users with Activity</div>
                                <div class="text-subtitle2 mt-2">{{ totalIdeChatModels }} Models Used</div>
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
                                <div class="text-h4 mb-2">{{ totalDotcomChatUsers }}</div>
                                <div class="text-caption">Total Users with Activity</div>
                                <div class="text-subtitle2 mt-2">{{ totalDotcomChatModels }} Models Used</div>
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
                                            Statistics for pull request summaries generated by Copilot on GitHub.com.
                                        </span>
                                    </v-card>
                                </v-tooltip>
                            </v-card-title>
                            <v-card-text>
                                <div class="text-h4 mb-2">{{ totalPRSummariesCreated }}</div>
                                <div class="text-caption">Total PR Summaries Created</div>
                                <div class="text-subtitle2 mt-2">{{ totalDotcomPRModels }} Models Used</div>
                            </v-card-text>
                        </v-card>
                    </v-col>
                </v-row>

                <!-- Agent Mode Statistics Chart -->
                <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                    <template #activator="{ props }">
                        <h2 v-bind="props" class="mb-1">GitHub.com Feature Usage Over Time</h2>
                    </template>
                    <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 400px;">
                        <span class="text-caption" style="font-size: 10px !important;">
                            This chart shows the usage of different GitHub.com Copilot features over time.
                        </span>
                    </v-card>
                </v-tooltip>
                <LineChart :data="agentModeChartData" :options="chartOptions" />

                <!-- Models Used Section -->
                <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                    <template #activator="{ props }">
                        <h2 v-bind="props" class="mb-4 mt-6">Models Used by Users</h2>
                    </template>
                    <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 400px;">
                        <span class="text-caption" style="font-size: 10px !important;">
                            This section shows detailed information about the AI models used across different GitHub.com Copilot features.
                        </span>
                    </v-card>
                </v-tooltip>

                <!-- Models by Agent Mode -->
                <v-expansion-panels class="mb-4">
                    <v-expansion-panel v-if="ideCodeCompletionModels.length > 0">
                        <v-expansion-panel-title>
                            <v-icon start>mdi-code-braces</v-icon>
                            IDE Code Completions Models ({{ ideCodeCompletionModels.length }})
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-data-table
                                :headers="codeCompletionHeaders"
                                :items="ideCodeCompletionModels"
                                class="elevation-1"
                                item-key="name"
                            >
                            </v-data-table>
                        </v-expansion-panel-text>
                    </v-expansion-panel>

                    <v-expansion-panel v-if="ideChatModels.length > 0">
                        <v-expansion-panel-title>
                            <v-icon start>mdi-chat</v-icon>
                            IDE Chat Models ({{ ideChatModels.length }})
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-data-table
                                :headers="ideChatHeaders"
                                :items="ideChatModels"
                                class="elevation-1"
                                item-key="name"
                            >
                            </v-data-table>
                        </v-expansion-panel-text>
                    </v-expansion-panel>

                    <v-expansion-panel v-if="dotcomChatModels.length > 0">
                        <v-expansion-panel-title>
                            <v-icon start>mdi-web</v-icon>
                            GitHub.com Chat Models ({{ dotcomChatModels.length }})
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-data-table
                                :headers="dotcomChatHeaders"
                                :items="dotcomChatModels"
                                class="elevation-1"
                                item-key="name"
                            >
                            </v-data-table>
                        </v-expansion-panel-text>
                    </v-expansion-panel>

                    <v-expansion-panel v-if="dotcomPRModels.length > 0">
                        <v-expansion-panel-title>
                            <v-icon start>mdi-source-pull</v-icon>
                            GitHub.com PR Summary Models ({{ dotcomPRModels.length }})
                        </v-expansion-panel-title>
                        <v-expansion-panel-text>
                            <v-data-table
                                :headers="dotcomPRHeaders"
                                :items="dotcomPRModels"
                                class="elevation-1"
                                item-key="name"
                            >
                            </v-data-table>
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
                            This chart shows the distribution of model usage across different GitHub.com Copilot features.
                        </span>
                    </v-card>
                </v-tooltip>
                <BarChart :data="modelUsageChartData" :options="barChartOptions" />
                </div>
            </v-container>
        </v-main>
    </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted, watch, computed, type PropType } from 'vue';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
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
    ideCodeCompletionModels: any[];
    ideChatModels: any[];
    dotcomChatModels: any[];
    dotcomPRModels: any[];
    agentModeChartData: any;
    modelUsageChartData: any;
}

export default defineComponent({
    name: 'AgentModeViewer',
    components: {
        LineChart,
        BarChart
    },
    props: {
        originalMetrics: {
            type: Array as PropType<CopilotMetrics[]>,
            required: true
        }
    },
    setup(props) {
        const stats = ref<GitHubStats>({
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
        });

        const loading = ref(false);
        const error = ref<string | null>(null);

        const fetchStats = async () => {
            if (props.originalMetrics.length === 0) return;
            
            loading.value = true;
            error.value = null;

            try {
                const response = await $fetch('/api/github-stats') as GitHubStats;
                stats.value = response;
            } catch (err: any) {
                error.value = err.message || 'Failed to fetch GitHub statistics';
                console.error('Error fetching GitHub stats:', err);
            } finally {
                loading.value = false;
            }
        };

        // Watch for changes in originalMetrics
        watch(() => props.originalMetrics, fetchStats, { immediate: true });

        // Table headers
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

        // Chart options
        const chartOptions = {
            responsive: true,
            maintainAspectRatio: false,
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
                    text: 'GitHub.com Feature Usage Over Time'
                }
            }
        };

        const barChartOptions = {
            responsive: true,
            maintainAspectRatio: false,
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
                }
            }
        };

        return {
            stats,
            loading,
            error,
            totalIdeCodeCompletionUsers: computed(() => stats.value.totalIdeCodeCompletionUsers),
            totalIdeChatUsers: computed(() => stats.value.totalIdeChatUsers),
            totalDotcomChatUsers: computed(() => stats.value.totalDotcomChatUsers),
            totalDotcomPRUsers: computed(() => stats.value.totalDotcomPRUsers),
            totalPRSummariesCreated: computed(() => stats.value.totalPRSummariesCreated),
            totalIdeCodeCompletionModels: computed(() => stats.value.totalIdeCodeCompletionModels),
            totalIdeChatModels: computed(() => stats.value.totalIdeChatModels),
            totalDotcomChatModels: computed(() => stats.value.totalDotcomChatModels),
            totalDotcomPRModels: computed(() => stats.value.totalDotcomPRModels),
            ideCodeCompletionModels: computed(() => stats.value.ideCodeCompletionModels),
            ideChatModels: computed(() => stats.value.ideChatModels),
            dotcomChatModels: computed(() => stats.value.dotcomChatModels),
            dotcomPRModels: computed(() => stats.value.dotcomPRModels),
            agentModeChartData: computed(() => stats.value.agentModeChartData),
            modelUsageChartData: computed(() => stats.value.modelUsageChartData),
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

.tiles-container {
    display: flex;
    justify-content: space-around;
    margin-bottom: 24px;
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
</style>
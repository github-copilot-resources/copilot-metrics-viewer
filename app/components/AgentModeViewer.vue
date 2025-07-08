<template>
    <div class="github-com-container">
        <v-main class="p-1" style="min-height: 300px;">
            <v-container style="min-height: 300px;" class="px-4 elevation-2">
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
            </v-container>
        </v-main>
    </div>
</template>

<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
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
        // Computed properties for totals
        const totalIdeCodeCompletionUsers = computed(() => {
            return props.originalMetrics.reduce((sum, metric) => {
                return sum + (metric.copilot_ide_code_completions?.total_engaged_users || 0);
            }, 0);
        });

        const totalIdeChatUsers = computed(() => {
            return props.originalMetrics.reduce((sum, metric) => {
                return sum + (metric.copilot_ide_chat?.total_engaged_users || 0);
            }, 0);
        });

        const totalDotcomChatUsers = computed(() => {
            return props.originalMetrics.reduce((sum, metric) => {
                return sum + (metric.copilot_dotcom_chat?.total_engaged_users || 0);
            }, 0);
        });

        const totalDotcomPRUsers = computed(() => {
            return props.originalMetrics.reduce((sum, metric) => {
                return sum + (metric.copilot_dotcom_pull_requests?.total_engaged_users || 0);
            }, 0);
        });

        const totalPRSummariesCreated = computed(() => {
            return props.originalMetrics.reduce((sum, metric) => {
                if (metric.copilot_dotcom_pull_requests?.repositories) {
                    return sum + metric.copilot_dotcom_pull_requests.repositories.reduce((repoSum, repo) => {
                        return repoSum + (repo.models?.reduce((modelSum, model) => {
                            return modelSum + (model.total_pr_summaries_created || 0);
                        }, 0) || 0);
                    }, 0);
                }
                return sum;
            }, 0);
        });

        // Computed properties for model counts
        const totalIdeCodeCompletionModels = computed(() => {
            const models = new Set<string>();
            props.originalMetrics.forEach(metric => {
                metric.copilot_ide_code_completions?.editors?.forEach(editor => {
                    editor.models?.forEach(model => {
                        models.add(model.name);
                    });
                });
            });
            return models.size;
        });

        const totalIdeChatModels = computed(() => {
            const models = new Set<string>();
            props.originalMetrics.forEach(metric => {
                metric.copilot_ide_chat?.editors?.forEach(editor => {
                    editor.models?.forEach(model => {
                        models.add(model.name);
                    });
                });
            });
            return models.size;
        });

        const totalDotcomChatModels = computed(() => {
            const models = new Set<string>();
            props.originalMetrics.forEach(metric => {
                metric.copilot_dotcom_chat?.models?.forEach(model => {
                    models.add(model.name);
                });
            });
            return models.size;
        });

        const totalDotcomPRModels = computed(() => {
            const models = new Set<string>();
            props.originalMetrics.forEach(metric => {
                metric.copilot_dotcom_pull_requests?.repositories?.forEach(repo => {
                    repo.models?.forEach(model => {
                        models.add(model.name);
                    });
                });
            });
            return models.size;
        });

        // Model data for tables
        const ideCodeCompletionModels = computed(() => {
            const modelMap = new Map();
            props.originalMetrics.forEach(metric => {
                metric.copilot_ide_code_completions?.editors?.forEach(editor => {
                    editor.models?.forEach(model => {
                        const key = `${model.name}-${editor.name}`;
                        if (!modelMap.has(key)) {
                            modelMap.set(key, {
                                name: model.name,
                                editor: editor.name,
                                model_type: model.is_custom_model ? 'Custom' : 'Default',
                                total_engaged_users: 0
                            });
                        }
                        modelMap.get(key).total_engaged_users += model.total_engaged_users;
                    });
                });
            });
            return Array.from(modelMap.values());
        });

        const ideChatModels = computed(() => {
            const modelMap = new Map();
            props.originalMetrics.forEach(metric => {
                metric.copilot_ide_chat?.editors?.forEach(editor => {
                    editor.models?.forEach(model => {
                        const key = `${model.name}-${editor.name}`;
                        if (!modelMap.has(key)) {
                            modelMap.set(key, {
                                name: model.name,
                                editor: editor.name,
                                model_type: model.is_custom_model ? 'Custom' : 'Default',
                                total_engaged_users: 0,
                                total_chats: 0,
                                total_chat_insertion_events: 0,
                                total_chat_copy_events: 0
                            });
                        }
                        const entry = modelMap.get(key);
                        entry.total_engaged_users += model.total_engaged_users;
                        entry.total_chats += model.total_chats;
                        entry.total_chat_insertion_events += model.total_chat_insertion_events;
                        entry.total_chat_copy_events += model.total_chat_copy_events;
                    });
                });
            });
            return Array.from(modelMap.values());
        });

        const dotcomChatModels = computed(() => {
            const modelMap = new Map();
            props.originalMetrics.forEach(metric => {
                metric.copilot_dotcom_chat?.models?.forEach(model => {
                    if (!modelMap.has(model.name)) {
                        modelMap.set(model.name, {
                            name: model.name,
                            model_type: model.is_custom_model ? 'Custom' : 'Default',
                            total_engaged_users: 0,
                            total_chats: 0
                        });
                    }
                    const entry = modelMap.get(model.name);
                    entry.total_engaged_users += model.total_engaged_users;
                    entry.total_chats += model.total_chats;
                });
            });
            return Array.from(modelMap.values());
        });

        const dotcomPRModels = computed(() => {
            const modelMap = new Map();
            props.originalMetrics.forEach(metric => {
                metric.copilot_dotcom_pull_requests?.repositories?.forEach(repo => {
                    repo.models?.forEach(model => {
                        const key = `${model.name}-${repo.name}`;
                        if (!modelMap.has(key)) {
                            modelMap.set(key, {
                                name: model.name,
                                repository: repo.name,
                                model_type: model.is_custom_model ? 'Custom' : 'Default',
                                total_engaged_users: 0,
                                total_pr_summaries_created: 0
                            });
                        }
                        const entry = modelMap.get(key);
                        entry.total_engaged_users += model.total_engaged_users;
                        entry.total_pr_summaries_created += model.total_pr_summaries_created;
                    });
                });
            });
            return Array.from(modelMap.values());
        });

        // Chart data
        const agentModeChartData = computed(() => {
            const labels = props.originalMetrics.map(metric => metric.date);
            return {
                labels,
                datasets: [
                    {
                        label: 'IDE Code Completions',
                        data: props.originalMetrics.map(metric => metric.copilot_ide_code_completions?.total_engaged_users || 0),
                        borderColor: 'rgb(75, 192, 192)',
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: 'IDE Chat',
                        data: props.originalMetrics.map(metric => metric.copilot_ide_chat?.total_engaged_users || 0),
                        borderColor: 'rgb(255, 99, 132)',
                        backgroundColor: 'rgba(255, 99, 132, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: 'GitHub.com Chat',
                        data: props.originalMetrics.map(metric => metric.copilot_dotcom_chat?.total_engaged_users || 0),
                        borderColor: 'rgb(153, 102, 255)',
                        backgroundColor: 'rgba(153, 102, 255, 0.2)',
                        tension: 0.1
                    },
                    {
                        label: 'GitHub.com PR',
                        data: props.originalMetrics.map(metric => metric.copilot_dotcom_pull_requests?.total_engaged_users || 0),
                        borderColor: 'rgb(255, 159, 64)',
                        backgroundColor: 'rgba(255, 159, 64, 0.2)',
                        tension: 0.1
                    }
                ]
            };
        });

        const modelUsageChartData = computed(() => {
            return {
                labels: ['IDE Code Completions', 'IDE Chat', 'GitHub.com Chat', 'GitHub.com PR'],
                datasets: [
                    {
                        label: 'Total Models',
                        data: [
                            totalIdeCodeCompletionModels.value,
                            totalIdeChatModels.value,
                            totalDotcomChatModels.value,
                            totalDotcomPRModels.value
                        ],
                        backgroundColor: [
                            'rgba(75, 192, 192, 0.6)',
                            'rgba(255, 99, 132, 0.6)',
                            'rgba(153, 102, 255, 0.6)',
                            'rgba(255, 159, 64, 0.6)'
                        ],
                        borderColor: [
                            'rgb(75, 192, 192)',
                            'rgb(255, 99, 132)',
                            'rgb(153, 102, 255)',
                            'rgb(255, 159, 64)'
                        ],
                        borderWidth: 1
                    }
                ]
            };
        });

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
            totalIdeCodeCompletionUsers,
            totalIdeChatUsers,
            totalDotcomChatUsers,
            totalDotcomPRUsers,
            totalPRSummariesCreated,
            totalIdeCodeCompletionModels,
            totalIdeChatModels,
            totalDotcomChatModels,
            totalDotcomPRModels,
            ideCodeCompletionModels,
            ideChatModels,
            dotcomChatModels,
            dotcomPRModels,
            agentModeChartData,
            modelUsageChartData,
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
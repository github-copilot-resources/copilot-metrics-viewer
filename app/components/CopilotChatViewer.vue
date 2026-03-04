<template>
    <div class="tiles-container">      
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
            <v-card-item>
                <div class="tiles-text">
                    <div class="spacing-25"/>
                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                      <template #activator="{ props }">
                        <div v-bind="props" class="text-h6 mb-1">Cumulative Chat Interactions</div>
                      </template>
                      <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                        <span class="text-caption" style="font-size: 10px !important;">Total number of user-initiated chat interactions across all modes (agent, ask, edit, custom, inline). Each interaction is one user prompt sent to Copilot.</span>
                      </v-card>
                    </v-tooltip>
                    <div class="text-caption">{{ dateRangeDescription }}</div>
                    <p class="text-h4">{{ cumulativeNumberTurns }}</p>
                </div>
            </v-card-item>
        </v-card>

        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
            <v-card-item>
                <div class="tiles-text">
                    <div class="spacing-10"/>
                    <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                      <template #activator="{ props }">
                        <div v-bind="props" class="text-h6 mb-1">Cumulative Code Actions</div>
                      </template>
                      <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                        <span class="text-caption" style="font-size: 10px !important;">Total number of code actions taken from chat responses — includes applying code to file, inserting at cursor, and using the Copy button.</span>
                      </v-card>
                    </v-tooltip>
                    <div class="text-caption">{{ dateRangeDescription }}</div>
                    <p class="text-h4">{{ cumulativeNumberAcceptances }}</p>
                </div>
            </v-card-item>
        </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">
        <v-container style="min-height: 300px;" class="px-4 elevation-2">

            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <h2 v-bind="props" class="mb-1">Code Actions | Chat Interactions</h2>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">Daily count of chat interactions (user prompts) and code actions (apply, insert, copy from chat responses).</span>
              </v-card>
            </v-tooltip>
            <Line :data="totalNumberAcceptancesAndTurnsChartData" :options="chartOptions" />

            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <h2 v-bind="props" class="mb-1">Total Active Copilot Chat Users</h2>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">A bar chart that illustrates the total number of users who have actively interacted with Copilot over the past 28 days.</span>
              </v-card>
            </v-tooltip>
            <Bar :data="totalActiveCopilotChatUsersChartData" :options="totalActiveChatUsersChartOptions" />

        </v-container>
    </v-main>
</template>
  
<script lang="ts">
  import { defineComponent, ref, toRef } from 'vue';
  import type { Metrics } from '@/model/Metrics';
  import { Line, Bar } from 'vue-chartjs'
  import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  ArcElement, 
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
)

export default defineComponent({
name: 'CopilotChatViewer',
components: {
Bar,
Line
},
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

    const cumulativeNumberAcceptances = ref(0);

    const cumulativeNumberTurns = ref(0);

    //Total Copilot Chat Active Users
    const totalActiveCopilotChatUsersChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });  

    const totalActiveChatUsersChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    scales: {
        y: {
        beginAtZero: true,
        ticks: {
            stepSize: 1
        }
        }
    },
    layout: {
        padding: {
        left: 50,
        right: 50,
        top: 50,
        bottom: 50
        }
    },
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
        height: 300,
        width: 300,
        layout: {
            padding: {
            left: 150,
            right: 150,
            top: 20,
            bottom: 40
            }
        },
    };

    //Total Number Acceptances And Turns
    const totalNumberAcceptancesAndTurnsChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const data = toRef(props, 'metrics').value;

    cumulativeNumberTurns.value = 0;
    const cumulativeNumberTurnsData = data.map((m: Metrics)  => {        
        cumulativeNumberTurns.value += m.total_chat_turns;
        return m.total_chat_turns;
    });

    cumulativeNumberAcceptances.value = 0;
    const cumulativeNumberAcceptancesData = data.map((m: Metrics)  => {        
        cumulativeNumberAcceptances.value += m.total_chat_acceptances;
        return m.total_chat_acceptances;
    });

    totalNumberAcceptancesAndTurnsChartData.value = {
    labels: data.map((m: Metrics)  => m.day),
        datasets: [
        {
            label: 'Code Actions',
            data: cumulativeNumberAcceptancesData,
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)'

        },
        {
            label: 'Chat Interactions',
            data: cumulativeNumberTurnsData,
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)'
        }]
    };

    totalActiveCopilotChatUsersChartData.value = {
        labels: data.map((m: Metrics) => m.day),
        datasets: [
        {
            label: 'Total Active Copilot Chat Users',
            data: data.map((m: Metrics) => m.total_active_chat_users),
            backgroundColor: 'rgba(0, 0, 139, 0.2)', // dark blue with 20% opacity
            borderColor: 'rgba(255, 99, 132, 1)'
        }]
    };
    
    return {  totalActiveCopilotChatUsersChartData, totalActiveChatUsersChartOptions,cumulativeNumberAcceptances, cumulativeNumberTurns, totalNumberAcceptancesAndTurnsChartData, chartOptions};
}
});

</script>

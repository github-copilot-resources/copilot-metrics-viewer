<template>
    <!-- API Error Message -->
    <div v-if="apiError" class="error-message" v-html="apiError"></div>
    <div v-if="!apiError">
        <div class="tiles-container">      
            <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
            <v-card-item>
                <div>
                <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                <div class="text-h6 mb-1">Cumulative Number of Turns</div>
                <div class="text-caption">
                    Over the last 28 days
                </div>
                <p>{{ cumulativeNumberTurns }}</p>
                </div>
            </v-card-item>
            </v-card>

            <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
            <v-card-item>
                <div>
                <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                <div class="text-h6 mb-1">Cumulative Number of Acceptances</div>
                <div class="text-caption">
                    Over the last 28 days
                </div>
                <p>{{ cumulativeNumberAcceptances }}</p>
                </div>
            </v-card-item>
            </v-card>
        </div>
        <v-main class="p-1" style="min-height: 300px;">

        <v-container style="min-height: 300px;" class="px-4 elevation-2">

        <h2>Total Acceptances | Total Turns Count</h2>
        <Line :data="totalNumberAcceptancesAndTurnsChartData" :options="chartOptions" />

        <h2>Total Active Copilot Chat Users</h2>
        <Bar :data="totalActiveCopilotChatUsersChartData" :options="totalActiveChatUsersChartOptions" />

        </v-container>
      </v-main>
    
  </div>

</template>
  
<script lang="ts">
  import { defineComponent, ref } from 'vue';
  import { getGitHubCopilotMetricsApi } from '../api/GitHubApi';
  import { Metrics } from '../model/MetricsData';
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

import { Line } from 'vue-chartjs'
import { Bar } from 'vue-chartjs'

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
    setup() {
        const metrics = ref<Metrics[]>([]);

        const apiError = ref<string>('');

        let cumulativeNumberAcceptances = ref(0);

        let cumulativeNumberTurns = ref(0);

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

        getGitHubCopilotMetricsApi().then(data => {
            metrics.value = data;

            console.log('Metrics Data: ' + JSON.stringify(data));

            cumulativeNumberTurns.value = 0;
            const cumulativeNumberTurnsData = data.map(m => {        
                cumulativeNumberTurns.value += m.total_chat_turns;
                return m.total_chat_turns;
            });

            cumulativeNumberAcceptances.value = 0;
            const cumulativeNumberAcceptancesData = data.map(m => {        
                cumulativeNumberAcceptances.value += m.total_chat_acceptances;
                return m.total_chat_acceptances;
            });

            totalNumberAcceptancesAndTurnsChartData.value = {
            labels: data.map(m => m.day),
                datasets: [
                {
                    label: 'Total Acceptances',
                    data: cumulativeNumberAcceptancesData,
                    backgroundColor: 'rgba(75, 192, 192, 0.2)',
                    borderColor: 'rgba(75, 192, 192, 1)'

                },
                {
                    label: 'Total Turns',
                    data: cumulativeNumberTurnsData,
                    backgroundColor: 'rgba(153, 102, 255, 0.2)',
                    borderColor: 'rgba(153, 102, 255, 1)'
                }

                ]
            };

            totalActiveCopilotChatUsersChartData.value = {
            labels: data.map(m => m.day),
            datasets: [
            {
                label: 'Total Active Copilot Chat Users',
                data: data.map(m => m.total_active_chat_users),
                backgroundColor: 'rgba(0, 0, 139, 0.2)', // dark blue with 20% opacity
                borderColor: 'rgba(255, 99, 132, 1)'
            }
            ]
            };

        }).catch(error => {
        console.log(error);
        // Check the status code of the error response
        if (error.response && error.response.status) {
            switch (error.response.status) {
            case 401:
                apiError.value = '401 Unauthorized access - check if your token in the .env file is correct.';
                break;
            case 404:
                apiError.value = `404 Not Found - is the organization '${process.env.VUE_APP_GITHUB_ORG}' correct?`;
                break;
            default:
                apiError.value = error.message;
                break;
            }
        } else {
            // Update apiError with the error message
            apiError.value = error.message;
        }
        // Add a new line to the apiError message
        apiError.value += ' <br> If .env file is modified, restart the changes to take effect.';
            
        });

        return {  apiError, metrics, totalActiveCopilotChatUsersChartData, totalActiveChatUsersChartOptions,cumulativeNumberAcceptances, cumulativeNumberTurns, totalNumberAcceptancesAndTurnsChartData, chartOptions};
    }
  });
  </script>
  
  <style scoped>
  .tiles-container {
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
}
  </style>
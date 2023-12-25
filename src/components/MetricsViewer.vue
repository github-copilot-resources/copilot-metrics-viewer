<template>
  <div>
    <h1>GitHub Copilot Business Metrics Viewer</h1>

      <!-- API Error Message -->
    <div v-if="apiError" class="error-message" v-html="apiError"></div>
      <div v-if="!apiError">
      <h2>Acceptance rate (%)</h2>
      <Bar :data="acceptanceRateChartData" :options="chartOptions" />

      <h2>Total Suggestions Count | Total Acceptances Count</h2>
      <Line :data="totalSuggestionsAndAcceptanceChartData" :options="chartOptions" />

      <h2>Total Lines Suggested | Total Lines Accepted</h2>
      <Line :data="chartData" :options="chartOptions" />

      <h2>Total Active Users</h2>
      <Bar :data="totalActiveUsersChartData" :options="totalActiveUsersChartOptions" />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { getGitHubCopilotMetricsApi } from '../api/GitHubApi';
import { Metrics } from '../model/MetricsData';
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
} from 'chart.js'

import { Line } from 'vue-chartjs'
import { Bar } from 'vue-chartjs'

ChartJS.register(
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
  name: 'MetricsViewer',
  components: {
    Line,
    Bar
  },
  setup() {
    const metrics = ref<Metrics[]>([]);

    //Acceptance Rate
    const acceptanceRateChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Total Suggestions Count | Total Acceptance Counts
    const totalSuggestionsAndAcceptanceChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Total Lines Suggested | Total Lines Accepted
    const chartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    
    //Total Active Users
    const totalActiveUsersChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });  

    // API Error Message
    const apiError = ref<string | null>(null);


    const chartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      layout: {
        padding: {
          left: 150,
          right: 150,
          top: 20,
          bottom: 40
        }
      },
    };

    const totalActiveUsersChartOptions = {
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

    getGitHubCopilotMetricsApi().then(data => {
      metrics.value = data;

      totalSuggestionsAndAcceptanceChartData.value = {
        labels: data.map(m => m.day),
        datasets: [
          {
            label: 'Total Suggestions',
            data: data.map(m => m.total_suggestions_count),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)'

          },
          {
            label: 'Total Acceptance',
            data: data.map(m => m.total_acceptances_count),
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)'
          },
          
        ]
      };

      chartData.value = {
        labels: data.map(m => m.day),
        datasets: [
          {
            label: 'Total Lines Suggested',
            data: data.map(m => m.total_lines_suggested),
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)'

          },
          {
            label: 'Total Lines Accepted',
            data: data.map(m => m.total_lines_accepted),
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            borderColor: 'rgba(153, 102, 255, 1)'
          }
        ]
      };

      acceptanceRateChartData.value = {
        labels: data
        .map(m => m.day),
        datasets: [
          {
            type: 'line', // This makes the dataset a line in the chart
            label: 'Acceptance Rate',
            data: data.map(m => m.total_lines_suggested !== 0 ? (m.total_lines_accepted / m.total_lines_suggested) * 100 : 0),
            backgroundColor: 'rgba(173, 216, 230, 0.2)', // light blue
            borderColor: 'rgba(173, 216, 230, 1)', // darker blue
            fill: false // This makes the area under the line not filled
          }
        ]
      };

      console.log("AcceptanceRateChartData");
      console.log(acceptanceRateChartData);

      totalActiveUsersChartData.value = {
        labels: data.map(m => m.day),
        datasets: [
          {
            label: 'Total Active Users',
            data: data.map(m => m.total_active_users),
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

    return { totalSuggestionsAndAcceptanceChartData, chartData, chartOptions, totalActiveUsersChartData, totalActiveUsersChartOptions, acceptanceRateChartData, apiError };
  }
});
</script>

<style scoped>
.error-message {
  color: red;
}
</style>
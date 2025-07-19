<template>
    <div class="tiles-container">      
        <MetricCard
          title="Cumulative Number of Turns"
          :value="cumulativeNumberTurns.toString()"
          :description="dateRangeDescription"
          icon="mdi-chat-processing"
          color="primary"
          :is-dark-theme="isDarkTheme"
        />

        <MetricCard
          title="Cumulative Number of Acceptances"
          :value="cumulativeNumberAcceptances.toString()"
          :description="dateRangeDescription"
          icon="mdi-check-circle"
          color="success"
          :is-dark-theme="isDarkTheme"
        />
    </div>

    <v-main class="p-1" style="min-height: 300px;">
        <v-container style="min-height: 300px;" class="px-4 elevation-2 chart-container">
            <h2 class="chart-title">Total Acceptances | Total Turns Count</h2>
            <div class="chart-wrapper">
              <Line :data="totalNumberAcceptancesAndTurnsChartData" :options="chartOptions" />
            </div>

            <v-divider class="my-6"></v-divider>
            
            <h2 class="chart-title">Total Active Copilot Chat Users</h2>
            <div class="chart-wrapper">
              <Bar :data="totalActiveCopilotChatUsersChartData" :options="totalActiveChatUsersChartOptions" />
            </div>
        </v-container>
    </v-main>
</template>
  
<script lang="ts">
  import { defineComponent, ref, toRef, computed } from 'vue';
  import type { Metrics } from '@/model/Metrics';
  import { Line, Bar } from 'vue-chartjs';
  import MetricCard from './MetricCard.vue';
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
        },
        isDarkTheme: {
            type: Boolean,
            default: false
        }
    },
setup(props) {

    const cumulativeNumberAcceptances = ref(0);

    const cumulativeNumberTurns = ref(0);

    //Total Copilot Chat Active Users
    const totalActiveCopilotChatUsersChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });  

    // Use consistent chart options for both charts
    const chartOptions = computed(() => ({
        responsive: true,
        maintainAspectRatio: false,
        height: 400,
        plugins: {
            legend: {
                position: 'top',
                labels: {
                    color: props.isDarkTheme ? '#F8F8F2' : '#333333',
                    font: {
                        size: 12
                    }
                }
            },
            tooltip: {
                backgroundColor: props.isDarkTheme ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.9)',
                titleColor: props.isDarkTheme ? '#8BE9FD' : '#26A69A',
                bodyColor: props.isDarkTheme ? '#F8F8F2' : '#333333',
                borderColor: 'rgba(100, 216, 203, 0.3)',
                borderWidth: 1
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    color: props.isDarkTheme ? '#BFBFBF' : '#666666'
                },
                grid: {
                    color: props.isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }
            },
            x: {
                ticks: {
                    color: props.isDarkTheme ? '#BFBFBF' : '#666666'
                },
                grid: {
                    color: props.isDarkTheme ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
                }
            }
        },
        elements: {
            line: {
                tension: 0.4 // Add curve to all line charts
            }
        }
    }));
    
    // Use the same options for both charts for consistent alignment
    const totalActiveChatUsersChartOptions = computed(() => chartOptions.value);

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
            label: 'Total Acceptances',
            data: cumulativeNumberAcceptancesData,
            backgroundColor: 'rgba(100, 216, 203, 0.3)',
            borderColor: '#64D8CB',
            borderWidth: 2,
            tension: 0.4,  // Add curve to the line
            fill: false
        },
        {
            label: 'Total Turns',
            data: cumulativeNumberTurnsData,
            backgroundColor: 'rgba(156, 100, 216, 0.3)',
            borderColor: '#9C64D8',
            borderWidth: 2,
            tension: 0.4,  // Add curve to the line
            fill: false
        }]
    };

    totalActiveCopilotChatUsersChartData.value = {
        labels: data.map((m: Metrics) => m.day),
        datasets: [
        {
            label: 'Total Active Copilot Chat Users',
            data: data.map((m: Metrics) => m.total_active_chat_users),
            backgroundColor: 'rgba(139, 233, 253, 0.3)', // Cyan with transparency
            borderColor: '#8BE9FD',
            borderWidth: 2,
            borderRadius: 4,
            maxBarThickness: 40
        }]
    };
    
    return {  totalActiveCopilotChatUsersChartData, totalActiveChatUsersChartOptions,cumulativeNumberAcceptances, cumulativeNumberTurns, totalNumberAcceptancesAndTurnsChartData, chartOptions};
}
});

</script>

<style scoped>
.chart-title {
  color: v-bind('isDarkTheme ? "#8BE9FD" : "#26A69A"');
  font-weight: 700;
  font-size: 1.5rem;
  margin: 16px 0;
  text-shadow: v-bind('isDarkTheme ? "0 2px 4px rgba(0, 0, 0, 0.5)" : "none"');
  position: relative;
  z-index: 2;
}

.chart-container {
  background-color: v-bind('isDarkTheme ? "rgba(18, 18, 18, 0.8)" : "rgba(255, 255, 255, 0.8)"') !important;
  border: 1px solid v-bind('isDarkTheme ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"');
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
}

.chart-wrapper {
  margin-bottom: 32px;
  position: relative;
  height: 400px;
  width: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

:deep(.chartjs-render-monitor) {
  filter: drop-shadow(0 0 8px rgba(100, 216, 203, 0.2));
}
</style>

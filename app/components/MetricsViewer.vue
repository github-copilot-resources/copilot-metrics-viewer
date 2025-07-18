<template>
  <div>
    <div class="tiles-container">      
      <MetricCard
        title="Acceptance Rate (by count)"
        :value="`${acceptanceRateAverageByCount.toFixed(2)}%`"
        description="Ratio of accepted suggestions to total suggestions made by GitHub Copilot"
        icon="mdi-check-circle-outline"
        color="success"
        :is-dark-theme="isDarkTheme"
      />
      
      <MetricCard
        title="Total Suggestions"
        :value="cumulativeNumberSuggestions.toLocaleString()"
        description="Total number of code suggestions made by GitHub Copilot"
        icon="mdi-lightbulb-outline"
        color="primary"
        :is-dark-theme="isDarkTheme"
      />
      
      <MetricCard
        title="Acceptance Rate (by lines)"
        :value="`${acceptanceRateAverageByLines.toFixed(2)}%`"
        description="Ratio of accepted lines of code to total lines suggested"
        icon="mdi-file-check-outline"
        color="info"
        :is-dark-theme="isDarkTheme"
      />
      
      <MetricCard
        title="Total Lines Suggested"
        :value="totalLinesSuggested.toLocaleString()"
        description="Total number of lines of code suggested by GitHub Copilot"
        icon="mdi-code-braces"
        color="accent"
        :is-dark-theme="isDarkTheme"
      />
    </div>

    <v-main class="p-1" style="min-height: 300px;">

      <v-container style="min-height: 300px;" class="px-4 elevation-2 chart-container">
      <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
        <template #activator="{ props }">
          <h2 v-bind="props" class="chart-title">Acceptance rate by count (%)</h2>
        </template>
        <v-card class="tooltip-card pa-3">
          <span class="tooltip-text">This metric represents the ratio of accepted suggestions to the total suggestions made by GitHub Copilot. This rate indicates the relevance and usefulness of Copilot's suggestions based on the number of prompts, but should be used with caution as developers use Copilot in various ways (research, confirm, verify, etc., not always "inject").</span>
        </v-card>
      </v-tooltip>
      <Bar :data="acceptanceRateByCountChartData" :options="chartOptions" />

      <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
        <template #activator="{ props }">
          <h2 v-bind="props" class="chart-title">Total Suggestions Count | Total Acceptances Count</h2>
        </template>
        <v-card class="tooltip-card pa-3">
          <span class="tooltip-text">This visualization focuses on the total number of suggestions accepted by users.</span>
        </v-card>
      </v-tooltip>
      <Line :data="totalSuggestionsAndAcceptanceChartData" :options="chartOptions" />

      <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
        <template #activator="{ props }">
          <h2 v-bind="props" class="chart-title">Acceptance rate by lines (%)</h2>
        </template>
        <v-card class="tooltip-card pa-3">
          <span class="tooltip-text">This metric represents the ratio of accepted lines of code to the total lines suggested by GitHub Copilot. This rate indicates the relevance and usefulness of Copilot's suggestions based on the volume of code, but should be used with caution as developers use Copilot in various ways (research, confirm, verify, etc., not always "inject").</span>
        </v-card>
      </v-tooltip>
      <Bar :data="acceptanceRateByLinesChartData" :options="chartOptions" />

      <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
        <template #activator="{ props }">
          <h2 v-bind="props" class="chart-title">Total Lines Suggested | Total Lines Accepted</h2>
        </template>
        <v-card class="tooltip-card pa-3">
          <span class="tooltip-text">As the name suggests, the total lines of code accepted by users (full acceptances) offering insights into how much of the suggested code is actually being utilized and incorporated into the codebase.</span>
        </v-card>
      </v-tooltip>
      <Line :data="chartData" :options="chartOptions" />

      <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
        <template #activator="{ props }">
          <h2 v-bind="props" class="chart-title">Total Active Users</h2>
        </template>
        <v-card class="tooltip-card pa-3">
          <span class="tooltip-text">Represents the number of active users engaging with GitHub Copilot. This helps in understanding the user base growth and adoption rate.</span>
        </v-card>
      </v-tooltip>
      <Bar :data="totalActiveUsersChartData" :options="totalActiveUsersChartOptions" />

      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watchEffect } from 'vue';
import type { Metrics } from '@/model/Metrics';
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

import { Line, Bar } from 'vue-chartjs'
import MetricCard from './MetricCard.vue'

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
  name: 'MetricsViewer',
  components: {
    Line,
    Bar,
    MetricCard
  },
  props: {
        metrics: {
            type: Array as PropType<Metrics[]>,
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

    //Tiles
    const acceptanceRateAverageByLines = ref(0);
    const acceptanceRateAverageByCount = ref(0);
    const cumulativeNumberSuggestions = ref(0);
    const cumulativeNumberAcceptances = ref(0);
    const cumulativeNumberLOCAccepted = ref(0);
    const totalLinesSuggested = ref(0);

    //Acceptance Rate by lines
    const acceptanceRateByLinesChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Acceptance Rate by count
    const acceptanceRateByCountChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Total Suggestions Count | Total Acceptance Counts
    const totalSuggestionsAndAcceptanceChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Total Lines Suggested | Total Lines Accepted
    const chartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    
    //Total Active Users
    const totalActiveUsersChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });  

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
      plugins: {
        legend: {
          labels: {
            color: '#F8F8F2'  // Light text color for better readability
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          titleColor: '#8BE9FD',
          bodyColor: '#F8F8F2',
          borderColor: 'rgba(100, 216, 203, 0.3)',
          borderWidth: 1
        }
      },
      scales: {
        x: {
          ticks: {
            color: '#BFBFBF'  // Light gray for better readability
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        y: {
          ticks: {
            color: '#BFBFBF'  // Light gray for better readability
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      }
    };

    const totalActiveUsersChartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            stepSize: 1,
            color: '#BFBFBF'  // Light gray for better readability
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        },
        x: {
          ticks: {
            color: '#BFBFBF'  // Light gray for better readability
          },
          grid: {
            color: 'rgba(255, 255, 255, 0.1)'
          }
        }
      },
      plugins: {
        legend: {
          labels: {
            color: '#F8F8F2'  // Light text color for better readability
          }
        },
        tooltip: {
          backgroundColor: 'rgba(30, 30, 30, 0.8)',
          titleColor: '#8BE9FD',
          bodyColor: '#F8F8F2',
          borderColor: 'rgba(100, 216, 203, 0.3)',
          borderWidth: 1
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

    // Watch for changes in metrics prop and recalculate all data
    watchEffect(() => {
      const data = toRef(props, 'metrics').value;
      
      if (!data || data.length === 0) {
        return;
      }

      cumulativeNumberSuggestions.value = 0;
    const cumulativeSuggestionsData = data.map((m: Metrics) => {
      cumulativeNumberSuggestions.value += m.total_suggestions_count;
      return m.total_suggestions_count;
    });

    cumulativeNumberAcceptances.value = 0;
    const cumulativeAcceptancesData = data.map((m: Metrics) => {
      cumulativeNumberAcceptances.value += m.total_acceptances_count;
      return m.total_acceptances_count;
    });

    totalSuggestionsAndAcceptanceChartData.value = {
      labels: data.map((m: Metrics) => m.day),
      datasets: [
        {
          label: 'Total Suggestions',
          data: cumulativeSuggestionsData,
          backgroundColor: 'rgba(139, 233, 253, 0.3)',  // Cyan with transparency
          borderColor: '#8BE9FD'  // Solid cyan
        },
        {
          label: 'Total Acceptance',
          data: cumulativeAcceptancesData,
          backgroundColor: 'rgba(156, 100, 216, 0.3)',  // Purple with transparency
          borderColor: '#9C64D8'  // Solid purple
        },
      ]
    };

    cumulativeNumberLOCAccepted.value = 0;
    const cumulativeLOCAcceptedData = data.map((m: Metrics) => {
      const total_lines_accepted = m.total_lines_accepted;
      cumulativeNumberLOCAccepted.value += total_lines_accepted;
      return total_lines_accepted;
    });

    chartData.value = {
      labels: data.map((m: Metrics) => m.day),
      datasets: [
        {
          label: 'Total Lines Suggested',
          data: data.map((m: Metrics) => m.total_lines_suggested),
          backgroundColor: 'rgba(100, 216, 203, 0.3)',  // Teal with transparency
          borderColor: '#64D8CB'  // Solid teal
        },
        {
          label: 'Total Lines Accepted',
          data: cumulativeLOCAcceptedData,
          backgroundColor: 'rgba(156, 100, 216, 0.3)',  // Purple with transparency
          borderColor: '#9C64D8'  // Solid purple
        }
      ]
    };
    
    const acceptanceRatesByLines = data.map((m: Metrics) => {
      const rate = m.total_lines_suggested !== 0 ? (m.total_lines_accepted / m.total_lines_suggested) * 100 : 0;
      return rate;
    });

    const acceptanceRatesByCount = data.map((m: Metrics) => {
      const rate = m.total_suggestions_count !== 0 ? (m.total_acceptances_count / m.total_suggestions_count) * 100 : 0;
      return rate;
    });

    acceptanceRateByLinesChartData.value = {
      labels: data.map((m: Metrics) => m.day),
      datasets: [
        {
          type: 'line',
          label: 'Acceptance Rate by Lines',
          data: acceptanceRatesByLines,
          backgroundColor: 'rgba(139, 233, 253, 0.3)',  // Cyan with transparency
          borderColor: '#8BE9FD',  // Solid cyan
          fill: false,
          tension: 0.4  // Smooth curve
        }
      ]
    };

    acceptanceRateByCountChartData.value = {
      labels: data.map((m: Metrics) => m.day),
      datasets: [
        {
          type: 'line',
          label: 'Acceptance Rate by Count',
          data: acceptanceRatesByCount,
          backgroundColor: 'rgba(100, 216, 203, 0.3)',  // Teal with transparency
          borderColor: '#64D8CB',  // Solid teal
          fill: false,
          tension: 0.4  // Smooth curve
        }
      ]
    };
    
    totalLinesSuggested.value = data.reduce((sum: number, m: Metrics) => sum + m.total_lines_suggested, 0);

    if(totalLinesSuggested.value === 0){
      acceptanceRateAverageByLines.value = 0;
    } else {
      acceptanceRateAverageByLines.value = cumulativeNumberLOCAccepted.value / totalLinesSuggested.value * 100;
    }

    // Calculate acceptanceRateAverageByCount
    if (cumulativeNumberSuggestions.value === 0) {
      acceptanceRateAverageByCount.value = 0;
    } else {
      acceptanceRateAverageByCount.value = cumulativeNumberAcceptances.value / cumulativeNumberSuggestions.value * 100;
    }

    totalActiveUsersChartData.value = {
      labels: data.map((m: Metrics) => m.day),
      datasets: [
        {
          label: 'Total Active Users',
          data: data.map((m: Metrics) => m.total_active_users),
          backgroundColor: 'rgba(156, 100, 216, 0.3)',  // Purple with transparency
          borderColor: '#9C64D8'  // Solid purple
        }
      ]
    };
    
    }); // end of watchEffect

    return { totalSuggestionsAndAcceptanceChartData, chartData, 
      chartOptions, totalActiveUsersChartData, 
      totalActiveUsersChartOptions, acceptanceRateByLinesChartData, acceptanceRateByCountChartData, acceptanceRateAverageByLines, acceptanceRateAverageByCount, cumulativeNumberSuggestions, 
      cumulativeNumberAcceptances, cumulativeNumberLOCAccepted, totalLinesSuggested };
  },
  data () {
    return {
      data : {
        labels: ['VueJs', 'EmberJs', 'ReactJs', 'AngularJs'],
        datasets: [
          {
        backgroundColor: ['#41B883', '#E46651', '#00D8FF', '#DD1B16'],
        data: [40, 20, 80, 10]
        }
        ]
      },
      options : {
        responsive: true,
      maintainAspectRatio: false
      }
    }
  },
});
</script>

<style scoped>
.chart-title {
  color: #8BE9FD;
  margin-bottom: 16px;
  font-weight: 700;
  font-size: 1.25rem;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  position: relative;
  z-index: 2;
}

.tooltip-card {
  background-color: rgba(30, 30, 30, 0.95) !important;
  border: 1px solid rgba(139, 233, 253, 0.3);
  max-width: 350px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.tooltip-text {
  color: #F8F8F2 !important;
  font-size: 0.875rem !important;
  line-height: 1.5;
}

.chart-container {
  background-color: rgba(18, 18, 18, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 32px;
}

/* Ensure chart labels are visible */
:deep(.chartjs-render-monitor) {
  filter: drop-shadow(0 0 2px rgba(0, 0, 0, 0.5));
}

:deep(canvas) {
  margin: 16px 0 32px;
}
</style>
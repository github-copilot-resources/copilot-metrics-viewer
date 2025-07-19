<template>
  <div>
    <div class="tiles-container">
      <MetricCard
        :title="`Number of ${breakdownDisplayNamePlural}`"
        :value="numberOfBreakdowns.toString()"
        :description="`Total unique ${breakdownDisplayNamePlural.toLowerCase()} in the data`"
        icon="mdi-format-list-bulleted"
        color="primary"
        :is-dark-theme="isDarkTheme"
      />
    </div>

    <v-main class="p-1" style="min-height: 300px;">
      <v-container style="min-height: 300px;" class="px-4 elevation-2 chart-container">
        <v-row>
          <v-col cols="4">
            <v-card class="chart-card" :class="{ 'theme--dark': isDarkTheme }">
              <div class="card-accent"></div>
              <v-card-item class="d-flex flex-column align-center justify-center">
                <h3 class="text-subtitle-1 font-weight-medium mb-4">Top 5 {{ breakdownDisplayNamePlural }} by accepted suggestions</h3>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPrompts" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>

          <v-col cols="4">
            <v-card class="chart-card" :class="{ 'theme--dark': isDarkTheme }">
              <div class="card-accent"></div>
              <v-card-item class="d-flex flex-column align-center justify-center">
                <h3 class="text-subtitle-1 font-weight-medium mb-4">Acceptance Rate (by count) for Top 5</h3>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPromptsByCounts" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>

          <v-col cols="4">
            <v-card class="chart-card" :class="{ 'theme--dark': isDarkTheme }">
              <div class="card-accent"></div>
              <v-card-item class="d-flex flex-column align-center justify-center">
                <h3 class="text-subtitle-1 font-weight-medium mb-4">Acceptance Rate (by lines) for Top 5</h3>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPromptsByLines" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>

        <br>
        <h2 class="breakdown-title">{{ breakdownDisplayNamePlural }} Breakdown</h2>
        <br>

        <v-data-table 
          :headers="headers" 
          :items="breakdownList" 
          class="data-table elevation-2"
        >
          <template #item="{item}">
            <tr class="data-table-row">
              <td class="data-table-cell">{{ item.name }}</td>
              <td class="data-table-cell">{{ item.acceptedPrompts }}</td>
              <td class="data-table-cell">{{ item.suggestedPrompts }}</td>
              <td class="data-table-cell">{{ item.acceptedLinesOfCode }}</td>
              <td class="data-table-cell">{{ item.suggestedLinesOfCode }}</td>
              <td v-if="item.acceptanceRateByCount !== undefined" class="data-table-cell">{{ item.acceptanceRateByCount.toFixed(2) }}%</td>
              <td v-if="item.acceptanceRateByLines !== undefined" class="data-table-cell">{{ item.acceptanceRateByLines.toFixed(2) }}%</td>
            </tr>
          </template>
        </v-data-table>
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watch, computed } from 'vue';
import type { Metrics } from '@/model/Metrics';
import { Breakdown } from '@/model/Breakdown';
import { Pie } from 'vue-chartjs'
import MetricCard from './MetricCard.vue'

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
  name: 'BreakdownComponent',
  components: {
    Pie,
    MetricCard
  },
  props: {
      metrics: {
          type: Object,
          required: true
      },
      breakdownKey: {
          type: String,
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

    // Create a reactive reference to store the breakdowns.
    const breakdownList = ref<Breakdown[]>([]);

    // Number of breakdowns
    const numberOfBreakdowns = ref(0);

    // Breakdowns Chart Data for breakdowns breakdown Pie Chart
    const breakdownsChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Top 5 by accepted prompts
    const breakdownsChartDataTop5AcceptedPrompts = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Acceptance Rate by lines for top 5 by accepted prompts
    const breakdownsChartDataTop5AcceptedPromptsByLines = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Acceptance Rate by counts for top 5 by accepted prompts
    const breakdownsChartDataTop5AcceptedPromptsByCounts = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const chartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: {
            color: props.isDarkTheme ? '#F8F8F2' : '#333333',  // Text color based on theme
            font: {
              size: 12
            }
          },
          position: 'bottom'
        },
        tooltip: {
          backgroundColor: props.isDarkTheme ? 'rgba(30, 30, 30, 0.8)' : 'rgba(255, 255, 255, 0.9)',
          titleColor: props.isDarkTheme ? '#8BE9FD' : '#26A69A',
          bodyColor: props.isDarkTheme ? '#F8F8F2' : '#333333',
          borderColor: 'rgba(100, 216, 203, 0.3)',
          borderWidth: 1
        }
      }
    }));

    // Updated color palette to match the site theme
    const pieChartColors = ref([
      '#8BE9FD',  // Cyan
      '#64D8CB',  // Teal
      '#9C64D8',  // Purple
      '#50FA7B',  // Green
      '#FFB86C'   // Orange
    ]);

    // Function to process breakdown data
    const processBreakdownData = (data: Metrics[]) => {
      // Reset the breakdown list
      breakdownList.value = [];
      
      // Process the breakdown separately
      data.forEach((m: Metrics) => m.breakdown.forEach(breakdownData => 
      {
        const breakdownName = breakdownData[props.breakdownKey as keyof typeof breakdownData] as string;
        let breakdown = breakdownList.value.find(b => b.name === breakdownName);

        if (!breakdown) {
          // Create a new breakdown object if it does not exist
          breakdown = new Breakdown({
            name: breakdownName,
            acceptedPrompts: breakdownData.acceptances_count,
            suggestedPrompts: breakdownData.suggestions_count,
            suggestedLinesOfCode: breakdownData.lines_suggested,
            acceptedLinesOfCode: breakdownData.lines_accepted,
          });
          breakdownList.value.push(breakdown);
        } else {
          // Update the existing breakdown object
          breakdown.acceptedPrompts += breakdownData.acceptances_count;
          breakdown.suggestedPrompts += breakdownData.suggestions_count;
          breakdown.suggestedLinesOfCode += breakdownData.lines_suggested;
          breakdown.acceptedLinesOfCode += breakdownData.lines_accepted;
        }
        // Recalculate the acceptance rates
        breakdown.acceptanceRateByCount = breakdown.suggestedPrompts !== 0 ? (breakdown.acceptedPrompts / breakdown.suggestedPrompts) * 100 : 0;
        breakdown.acceptanceRateByLines = breakdown.suggestedLinesOfCode !== 0 ? (breakdown.acceptedLinesOfCode / breakdown.suggestedLinesOfCode) * 100 : 0;
      }));

      //Sort breakdowns map by accepted prompts
      breakdownList.value.sort((a, b) => b.acceptedPrompts - a.acceptedPrompts);

      // Get the top 5 breakdowns by accepted prompts
      const top5BreakdownsAcceptedPrompts = breakdownList.value.slice(0, 5);
      
      breakdownsChartDataTop5AcceptedPrompts.value = {
        labels: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.name),
        datasets: [
          {
            data: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.acceptedPrompts),
            backgroundColor: pieChartColors.value,
            borderWidth: 2,
            borderColor: 'rgba(18, 18, 18, 0.8)'
          },
        ],
      };

      breakdownsChartDataTop5AcceptedPromptsByLines.value = {
        labels: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.name),
        datasets: [
          {
            data: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.acceptanceRateByLines.toFixed(2)),
            backgroundColor: pieChartColors.value,
            borderWidth: 2,
            borderColor: 'rgba(18, 18, 18, 0.8)'
          },
        ],
      };

      breakdownsChartDataTop5AcceptedPromptsByCounts.value = {
        labels: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.name),
        datasets: [
          {
            data: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.acceptanceRateByCount.toFixed(2)),
            backgroundColor: pieChartColors.value,
            borderWidth: 2,
            borderColor: 'rgba(18, 18, 18, 0.8)'
          },
        ],
      };

      numberOfBreakdowns.value = breakdownList.value.length;
    };

    // Watch for changes in metrics prop and re-process data
    watch(() => props.metrics, (newMetrics) => {
      if (newMetrics && Array.isArray(newMetrics)) {
        processBreakdownData(newMetrics);
      }
    }, { immediate: true, deep: true });

    return { chartOptions, breakdownList, numberOfBreakdowns, 
      breakdownsChartData, breakdownsChartDataTop5AcceptedPrompts, breakdownsChartDataTop5AcceptedPromptsByLines, breakdownsChartDataTop5AcceptedPromptsByCounts };
  },
  computed: {
    breakdownDisplayName() {
      return this.breakdownKey.charAt(0).toUpperCase() + this.breakdownKey.slice(1);
    },
    breakdownDisplayNamePlural() {
      return `${this.breakdownDisplayName}s`;
    },
    headers() {
      return [
        { title: `${this.breakdownDisplayName} Name`, key: 'name' },
        { title: 'Accepted Prompts', key: 'acceptedPrompts' },
        { title: 'Suggested Prompts', key: 'suggestedPrompts' },
        { title: 'Accepted Lines of Code', key: 'acceptedLinesOfCode' },
        { title: 'Suggested Lines of Code', key: 'suggestedLinesOfCode' },
        { title: 'Acceptance Rate by Count (%)', key: 'acceptanceRateByCount' },
        { title: 'Acceptance Rate by Lines (%)', key: 'acceptanceRateByLines' },
      ];
    },
  },
});
</script>

<style scoped>
.chart-card {
  position: relative;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 12px;
  background-color: v-bind('isDarkTheme ? "rgba(18, 18, 18, 0.8)" : "rgba(255, 255, 255, 0.8)"') !important;
  border: 1px solid v-bind('isDarkTheme ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"');
  backdrop-filter: blur(10px);
  height: 100%;
}

.chart-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(100, 216, 203, 0.15) !important;
  border: 1px solid rgba(139, 233, 253, 0.2);
}

.theme--dark.chart-card:hover {
  box-shadow: 0 8px 24px rgba(100, 216, 203, 0.15) !important;
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #8BE9FD, #64D8CB, #9C64D8) !important;
  background-size: 200% 100%;
  animation: shimmer 3s infinite;
}

.text-subtitle-1 {
  color: v-bind('isDarkTheme ? "#8BE9FD" : "#26A69A"') !important;
}

.breakdown-title {
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

/* Data table styling for better readability */
.data-table {
  background-color: v-bind('isDarkTheme ? "rgba(18, 18, 18, 0.8)" : "rgba(255, 255, 255, 0.8)"') !important;
  border: 1px solid v-bind('isDarkTheme ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"');
  border-radius: 12px;
  overflow: hidden;
}

:deep(.v-data-table__thead) {
  background-color: v-bind('isDarkTheme ? "rgba(100, 216, 203, 0.1)" : "rgba(100, 216, 203, 0.05)"') !important;
}

:deep(.v-data-table__thead th) {
  color: v-bind('isDarkTheme ? "#8BE9FD" : "#26A69A"') !important;
  font-weight: 600 !important;
  font-size: 0.8rem !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.data-table-row {
  border-bottom: 1px solid v-bind('isDarkTheme ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)"');
}

.data-table-cell {
  color: v-bind('isDarkTheme ? "#F8F8F2" : "#333333"') !important;
  padding: 12px 16px;
}

:deep(.v-data-table__tbody tr:hover) {
  background-color: rgba(100, 216, 203, 0.05) !important;
}

@keyframes shimmer {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

/* Update pie chart colors to match our theme */
:deep(.chart-js-render-monitor) {
  filter: drop-shadow(0 0 8px rgba(100, 216, 203, 0.2));
}
</style>
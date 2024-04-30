<template>
  <div>
    <div class="tiles-container">      
      <!-- Acceptance Rate Tile -->  
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
          <v-card-item>
            <div>
              <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
              <div class="text-h6 mb-1">Acceptance Rate Average</div>
              <div class="text-caption">
                Over the last 28 days
              </div>
              <p>{{ acceptanceRateAverage.toFixed(2) }}%</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
        <v-card-item>
          <div>
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <div class="text-h6 mb-1">Cumulative Number of Suggestions</div>
            <div class="text-caption">
              Over the last 28 days
            </div>
            <p>{{ cumulativeNumberSuggestions }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
        <v-card-item>
          <div>
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <div class="text-h6 mb-1">Cumulative Number of Accepted Prompts</div>
            <div class="text-caption">
              Over the last 28 days
            </div>
            <p>{{ cumulativeNumberAcceptances }}</p>
          </div>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
        <v-card-item>
          <div>
            <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
            <div class="text-h6 mb-1">Cumulative Number of Lines of Code Accepted</div>
            <div class="text-caption">
              Over the last 28 days
            </div>
            <p>{{ cumulativeNumberLOCAccepted }}</p>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">

      <v-container style="min-height: 300px;" class="px-4 elevation-2">
        <h2>Acceptance rate (%)</h2>
      <Bar :data="acceptanceRateChartData" :options="chartOptions" />

      <h2>Total Suggestions Count | Total Acceptances Count</h2>
      <Line :data="totalSuggestionsAndAcceptanceChartData" :options="chartOptions" />

      <h2>Total Lines Suggested | Total Lines Accepted</h2>
      <Line :data="chartData" :options="chartOptions" />

      <h2>Total Active Users</h2>
      <Bar :data="totalActiveUsersChartData" :options="totalActiveUsersChartOptions" />

      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef } from 'vue';
import { Metrics } from '../model/Metrics';
import { Language } from '../model/Language';
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
  name: 'MetricsViewer',
  props: {
        metrics: {
            type: Object,
            required: true
        }
    },
  components: {
    Line,
    Bar
  }
  ,
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
  setup(props) {

    //Tiles
    let acceptanceRateAverage = ref(0);
    let cumulativeNumberSuggestions = ref(0);
    let cumulativeNumberAcceptances = ref(0);
    let cumulativeNumberLOCAccepted = ref(0);

    //Acceptance Rate
    const acceptanceRateChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Total Suggestions Count | Total Acceptance Counts
    const totalSuggestionsAndAcceptanceChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Total Lines Suggested | Total Lines Accepted
    const chartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    
    //Total Active Users
    const totalActiveUsersChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });  

    // Create an empty map to store the languages.
    const languages = new Map<string, Language>();

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

    const data = toRef(props, 'metrics').value;

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
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)'

        },
        {
          label: 'Total Acceptance',
          data: cumulativeAcceptancesData,
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)'
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
          backgroundColor: 'rgba(75, 192, 192, 0.2)',
          borderColor: 'rgba(75, 192, 192, 1)'

        },
        {
          label: 'Total Lines Accepted',
          data: cumulativeLOCAcceptedData,
          backgroundColor: 'rgba(153, 102, 255, 0.2)',
          borderColor: 'rgba(153, 102, 255, 1)'
        }
      ]
    };

    let sum = 0;
    const acceptanceRates = data.map((m: Metrics) => {
      const rate = m.total_lines_suggested !== 0 ? (m.total_lines_accepted / m.total_lines_suggested) * 100 : 0;
      sum += rate;
      return rate;
    });
    acceptanceRateAverage.value = sum / data.length;

    acceptanceRateChartData.value = {
      labels: data.map((m: Metrics) => m.day),
      datasets: [
        {
          type: 'line', // This makes the dataset a line in the chart
          label: 'Acceptance Rate',
          data: acceptanceRates,
          backgroundColor: 'rgba(173, 216, 230, 0.2)', // light blue
          borderColor: 'rgba(173, 216, 230, 1)', // darker blue
          fill: false // This makes the area under the line not filled
        }
      ]
    };

    totalActiveUsersChartData.value = {
      labels: data.map((m: Metrics) => m.day),
      datasets: [
        {
          label: 'Total Active Users',
          data: data.map((m: Metrics) => m.total_active_users),
          backgroundColor: 'rgba(0, 0, 139, 0.2)', // dark blue with 20% opacity
          borderColor: 'rgba(255, 99, 132, 1)'
        }
      ]
    };
    
    // Process the language breakdown separately
    data.forEach((m: Metrics) => m.breakdown.forEach(breakdown => 
    {
      const languageName = breakdown.language;
      let language = languages.get(languageName);

      if (!language) {
        // Create a new Language object if it does not exist
        language = new Language({
          name: languageName,
          acceptedPrompts: breakdown.acceptances_count,
          suggestedLinesOfCode: breakdown.lines_suggested,
          acceptedLinesOfCode: breakdown.lines_accepted,
        });
        languages.set(languageName, language);
      } else {
        // Update the existing Language object
        language.acceptedPrompts += breakdown.acceptances_count;
        language.suggestedLinesOfCode += breakdown.lines_suggested;
        language.acceptedLinesOfCode += breakdown.lines_accepted;
      }
      // Recalculate the acceptance rate
      language.acceptanceRate = language.suggestedLinesOfCode !== 0 ? (language.acceptedLinesOfCode / language.suggestedLinesOfCode) * 100 : 0;
    }));

    //Sort languages map by accepted lines of code
    languages[Symbol.iterator] = function* () {
      yield* [...this.entries()].sort((a, b) => b[1].acceptedLinesOfCode - a[1].acceptedLinesOfCode);
    }

    return { totalSuggestionsAndAcceptanceChartData, chartData, 
      chartOptions, totalActiveUsersChartData, 
      totalActiveUsersChartOptions, acceptanceRateChartData, acceptanceRateAverage, cumulativeNumberSuggestions, 
      cumulativeNumberAcceptances, cumulativeNumberLOCAccepted, languages };
  },
  
});
</script>

<style scoped>
.tiles-container {
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
}
</style>
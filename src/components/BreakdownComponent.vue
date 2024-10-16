<template>
  <div>
    <div class="tiles-container">
      <!-- Acceptance Rate Tile -->  
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-25"></div>
              <div class="text-h6 mb-1">Number of {{ breakdownDisplayNamePlural }}</div>
              <div class="text-caption">
                Over the last 28 days
              </div>
              <p class="text-h4">{{ numberOfBreakdowns }}</p> 
          </div>
        </v-card-item>
      </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">
      <v-container style="min-height: 300px;" class="px-4 elevation-2">
        <v-row>
          <v-col cols="6">
            <v-card>
              <v-card-item class="d-flex justify-center align-center">
                <div class="spacing-25"></div>
                <div class="text-h6 mb-1">Top 5 {{ breakdownDisplayNamePlural }} by accepted prompts</div>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPrompts" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>

          <v-col cols="6">
            <v-card>
              <v-card-item class="d-flex justify-center align-center">
                <div class="spacing-25"></div>
                <div class="text-h6 mb-1">Top 5 {{ breakdownDisplayNamePlural }} by acceptance rate</div>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptanceRate" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>

        <br>
        <h2>{{ breakdownDisplayNamePlural }} Breakdown </h2>
        <br>

        <v-data-table :headers="headers" :items="breakdownList" class="elevation-2" style="padding-left: 100px; padding-right: 100px;">
            <template v-slot:item="{item}">
                <tr>
                    <td>{{ item.name }}</td>
                    <td>{{ item.acceptedPrompts }}</td>
                    <td>{{ item.acceptedLinesOfCode }}</td>
                    <td v-if="item.acceptanceRate !== undefined">{{ item.acceptanceRate.toFixed(2) }}%</td>
                </tr>
            </template>
        </v-data-table>
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef } from 'vue';
import { Metrics } from '../model/Metrics';
import { Breakdown } from '../model/Breakdown';
import { Pie } from 'vue-chartjs'

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
  props: {
      metrics: {
          type: Object,
          required: true
      },
      breakdownKey: {
          type: String,
          required: true
      }
  },
  components: {
    Pie
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
        { title: 'Accepted Lines of Code', key: 'acceptedLinesOfCode' },
        { title: 'Acceptance Rate (%)', key: 'acceptanceRate' },
      ];
    },
  },
  setup(props) {

    // Create a reactive reference to store the breakdowns.
    const breakdownList = ref<Breakdown[]>([]);

    // Number of breakdowns
    const numberOfBreakdowns = ref(0);

    // Breakdowns Chart Data for breakdowns breakdown Pie Chart
    let breakdownsChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Top 5 by accepted prompts
    let breakdownsChartDataTop5AcceptedPrompts = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    //Top 5 by acceptance rate
    let breakdownsChartDataTop5AcceptanceRate = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: true,
    };

    const pieChartColors = ref([
    '#4B0082', '#41B883', '#483D8B', '#87CEFA', 
    '#32CD32'
  ]);

    const data = toRef(props, 'metrics').value;

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
          suggestedLinesOfCode: breakdownData.lines_suggested,
          acceptedLinesOfCode: breakdownData.lines_accepted,
        });
        breakdownList.value.push(breakdown);
      } else {
        // Update the existing breakdown object
        breakdown.acceptedPrompts += breakdownData.acceptances_count;
        breakdown.suggestedLinesOfCode += breakdownData.lines_suggested;
        breakdown.acceptedLinesOfCode += breakdownData.lines_accepted;
      }
      // Recalculate the acceptance rate
      breakdown.acceptanceRate = breakdown.suggestedLinesOfCode !== 0 ? (breakdown.acceptedLinesOfCode / breakdown.suggestedLinesOfCode) * 100 : 0;
    }));

    //Sort breakdowns map by acceptance rate
    breakdownList.value.sort((a, b) => b.acceptanceRate - a.acceptanceRate);

    // Get the top 5 breakdowns by acceptance rate
    const top5BreakdownsAcceptanceRate = breakdownList.value.slice(0, 5);

    breakdownsChartDataTop5AcceptanceRate.value = {
      labels: top5BreakdownsAcceptanceRate.map(breakdown => breakdown.name),
      datasets: [
        {
          data: top5BreakdownsAcceptanceRate.map(breakdown => breakdown.acceptanceRate.toFixed(2)),
          backgroundColor: pieChartColors.value,
        },
      ],
    };

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
        },
      ],
    };

    numberOfBreakdowns.value = breakdownList.value.length;

    return { chartOptions, breakdownList, numberOfBreakdowns, 
      breakdownsChartData, breakdownsChartDataTop5AcceptedPrompts, breakdownsChartDataTop5AcceptanceRate };
  },
  

});
</script>

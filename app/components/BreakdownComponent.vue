<template>
  <div>
    <!-- Filter Controls -->
    <v-row>
      <v-col cols="4">
        <v-select
          v-model="selectedLanguage"
          :items="languages"
          label="Filter by Language"
          clearable
        ></v-select>
      </v-col>
      <v-col cols="4">
        <v-select
          v-model="selectedModel"
          :items="models"
          label="Filter by Model"
          clearable
        ></v-select>
      </v-col>
      <v-col cols="4">
        <v-select
          v-model="selectedEditor"
          :items="editors"
          label="Filter by Editor"
          clearable
        ></v-select>
      </v-col>
    </v-row>

    <div class="tiles-container">
      <!-- Acceptance Rate Tile -->  
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-25"/>
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
          <v-col cols="4">
            <v-card>
              <v-card-item class="d-flex justify-center align-center">
                <div class="spacing-25"/>
                <div class="text-h6 mb-1">Top 5 {{ breakdownDisplayNamePlural }} by accepted suggestions (prompts)</div>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPrompts" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>

          <v-col cols="4">
            <v-card>
              <v-card-item class="d-flex justify-center align-center">
                <div class="spacing-25"/>
                <div class="text-h6 mb-1">Acceptance Rate (by count) for Top 5 {{ breakdownDisplayNamePlural }}</div>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPromptsByCounts" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>

          <v-col cols="4">
            <v-card>
              <v-card-item class="d-flex justify-center align-center">
                <div class="spacing-25"/>
                <div class="text-h6 mb-1">Acceptance Rate (by code lines) for Top 5 {{ breakdownDisplayNamePlural }}</div>
                <div style="width: 300px; height: 300px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPromptsByLines" :options="chartOptions" />
                </div>
              </v-card-item>
            </v-card>
          </v-col>
        </v-row>

        <br>
        <h2>{{ breakdownDisplayNamePlural }} Breakdown </h2>
        <br>

        <v-data-table :headers="headers" :items="filteredBreakdownList" class="elevation-2" style="padding-left: 100px; padding-right: 100px;">
            <template #item="{item}">
                <tr>
                    <td>{{ item.name }}</td>
                    <td>{{ item.acceptedPrompts }}</td>
                    <td>{{ item.suggestedPrompts }}</td>
                    <td>{{ item.acceptedLinesOfCode }}</td>
                    <td>{{ item.suggestedLinesOfCode }}</td>
                    <td v-if="item.acceptanceRateByCount !== undefined">{{ item.acceptanceRateByCount.toFixed(2) }}%</td>
                    <td v-if="item.acceptanceRateByLines !== undefined">{{ item.acceptanceRateByLines.toFixed(2) }}%</td>
                </tr>
            </template>
        </v-data-table>
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, computed, watch } from 'vue';
import type { Metrics } from '@/model/Metrics';
import { Breakdown } from '@/model/Breakdown';
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
  components: {
    Pie
  },
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
  setup(props) {
    const selectedLanguage = ref<string | null>(null);
    const selectedModel = ref<string | null>(null);
    const selectedEditor = ref<string | null>(null);

    const languages = ref<string[]>([]);
    const models = ref<string[]>([]);
    const editors = ref<string[]>([]);

    const breakdownList = ref<Breakdown[]>([]);
    const numberOfBreakdowns = ref(0);

    const breakdownsChartDataTop5AcceptedPrompts = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const breakdownsChartDataTop5AcceptedPromptsByLines = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const breakdownsChartDataTop5AcceptedPromptsByCounts = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: true,
    };

    const pieChartColors = ref([
      '#4B0082', // Indigo
      '#41B883', // Vue Green
      '#6495ED', // Cornflower Blue
      '#87CEFA', // Light Sky Blue
      '#7CFC00'  // Lawn Green
    ]);

    const data = toRef(props, 'metrics').value;

    data.forEach((m: Metrics) => m.breakdown.forEach(breakdownData=> {
      const breakdownName = breakdownData[props.breakdownKey as keyof typeof breakdownData] as string;
      let breakdown = breakdownList.value.find(b => b.name === breakdownName);

      if (!breakdown) {
        breakdown = new Breakdown({
          name: breakdownName,
          language: breakdownData.language,
          model: breakdownData.model,
          editor: breakdownData.editor,
          acceptedPrompts: breakdownData.acceptances_count,
          suggestedPrompts: breakdownData.suggestions_count,
          suggestedLinesOfCode: breakdownData.lines_suggested,
          acceptedLinesOfCode: breakdownData.lines_accepted,
        });
        breakdownList.value.push(breakdown);
      } else {
        breakdown.acceptedPrompts += breakdownData.acceptances_count;
        breakdown.suggestedPrompts += breakdownData.suggestions_count;
        breakdown.suggestedLinesOfCode += breakdownData.lines_suggested;
        breakdown.acceptedLinesOfCode += breakdownData.lines_accepted;
      }

      breakdown.acceptanceRateByCount = breakdown.suggestedPrompts !== 0 ? (breakdown.acceptedPrompts / breakdown.suggestedPrompts) * 100 : 0;
      breakdown.acceptanceRateByLines = breakdown.suggestedLinesOfCode !== 0 ? (breakdown.acceptedLinesOfCode / breakdown.suggestedLinesOfCode) * 100 : 0;
    }));

    breakdownList.value.sort((a, b) => b.acceptedPrompts - a.acceptedPrompts);

    const top5BreakdownsAcceptedPrompts = computed(() => breakdownList.value.slice(0, 5));

    const updateCharts = () => {
      const filteredBreakdowns = filteredBreakdownList.value;

      breakdownsChartDataTop5AcceptedPrompts.value = {
        labels: filteredBreakdowns.map(breakdown => breakdown.name),
        datasets: [
          {
            data: filteredBreakdowns.map(breakdown => breakdown.acceptedPrompts),
            backgroundColor: pieChartColors.value,
          },
        ],
      };

      breakdownsChartDataTop5AcceptedPromptsByLines.value = {
        labels: filteredBreakdowns.map(breakdown => breakdown.name),
        datasets: [
          {
            data: filteredBreakdowns.map(breakdown => breakdown.acceptanceRateByLines.toFixed(2)),
            backgroundColor: pieChartColors.value,
          },
        ],
      };

      breakdownsChartDataTop5AcceptedPromptsByCounts.value = {
        labels: filteredBreakdowns.map(breakdown => breakdown.name),
        datasets: [
          {
            data: filteredBreakdowns.map(breakdown => breakdown.acceptanceRateByCount.toFixed(2)),
            backgroundColor: pieChartColors.value,
          },
        ],
      };

      numberOfBreakdowns.value = filteredBreakdowns.length;
    };

    const filteredBreakdownList = computed(() => {
      return breakdownList.value.filter(breakdown => {
        const matchesLanguage = !selectedLanguage.value || breakdown.name.includes(selectedLanguage.value);
        const matchesModel = !selectedModel.value || breakdown.name.includes(selectedModel.value);
        const matchesEditor = !selectedEditor.value || breakdown.name.includes(selectedEditor.value);
        return matchesLanguage && matchesModel && matchesEditor;
      });
    });

    watch([selectedLanguage, selectedModel, selectedEditor], updateCharts);

    return {
      chartOptions,
      breakdownList,
      numberOfBreakdowns,
      breakdownsChartDataTop5AcceptedPrompts,
      breakdownsChartDataTop5AcceptedPromptsByLines,
      breakdownsChartDataTop5AcceptedPromptsByCounts,
      selectedLanguage,
      selectedModel,
      selectedEditor,
      languages,
      models,
      editors,
      filteredBreakdownList
    };
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

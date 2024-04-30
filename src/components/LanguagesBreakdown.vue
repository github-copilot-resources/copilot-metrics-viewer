<template>
    <div>
      <div class="tiles-container">
        <!-- Acceptance Rate Tile -->  
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
            <v-card-item>
              <div>
                <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                <div class="text-h6 mb-1">Number of languages</div>
                <div class="text-caption">
                  Over the last 28 days
                </div>
                <p>{{ numberOfLanguages }}</p> 
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
                  <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                  <div class="text-h6 mb-1">Top 5 languages by accepted prompts</div>
                  <div style="width: 300px; height: 300px;">
                    <Pie :data="languagesChartDataTop5AcceptedPrompts" :options="chartOptions" />
                  </div>
                </v-card-item>
              </v-card>
            </v-col>

            <v-col cols="6">
              <v-card>
                <v-card-item class="d-flex justify-center align-center">
                  <div class="text-overline mb-1" style="visibility: hidden;">filler</div>
                  <div class="text-h6 mb-1">Top 5 languages by acceptance rate</div>
                  <div style="width: 300px; height: 300px;">
                    <Pie :data="languagesChartDataTop5AcceptanceRate" :options="chartOptions" />
                  </div>
                </v-card-item>
              </v-card>
            </v-col>
          </v-row>

          <br>
          <h2>Languages Breakdown </h2>
          <br>

          <v-data-table :headers="headers" :items="Array.from(languages)" class="elevation-2" style="padding-left: 100px; padding-right: 100px;">
              <template v-slot:item="{item}">
                  <tr>
                      <td>{{ item[0] }}</td>
                      <td>{{ item[1].acceptedPrompts }}</td>
                      <td>{{ item[1].acceptedLinesOfCode }}</td>
                      <td v-if="item[1].acceptanceRate !== undefined">{{ item[1].acceptanceRate.toFixed(2) }}%</td>
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
  import { Language } from '../model/Language';
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
    name: 'LanguagesBreakdown',
    props: {
        metrics: {
            type: Object,
            required: true
        }
    },
    components: {
      Pie
    },
    data() {
      return {
        headers: [
          { title: 'Language Name', key: 'languageName' },
          { title: 'Accepted Prompts', key: 'acceptedPrompts' },
          { title: 'Accepted Lines of Code', key: 'acceptedLinesOfCode' },
          { title: 'Acceptance Rate (%)', key: 'acceptanceRate' },
        ],
      };
    },
    setup(props) {
  
      // Create an empty map to store the languages.
      const languages = ref(new Map<string, Language>());

      // Number of languages
      const numberOfLanguages = ref(0);
  
      // Languages Chart Data for languages breakdown Pie Chart
      let languagesChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

      //Top 5 by accepted prompts
      let languagesChartDataTop5AcceptedPrompts = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

      //Top 5 by acceptance rate
      let languagesChartDataTop5AcceptanceRate = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
  
      const chartOptions = {
        responsive: true,
        maintainAspectRatio: true,
      };

      const pieChartColors = ref([
      '#4B0082', '#41B883', '#483D8B', '#87CEFA', 
      '#32CD32'
    ]);

      const data = toRef(props, 'metrics').value;
 
      // Process the language breakdown separately
      data.forEach((m: Metrics) => m.breakdown.forEach(breakdown => 
      {
        const languageName = breakdown.language;
        let language = languages.value.get(languageName);

        if (!language) {
          // Create a new Language object if it does not exist
          language = new Language({
            name: languageName,
            acceptedPrompts: breakdown.acceptances_count,
            suggestedLinesOfCode: breakdown.lines_suggested,
            acceptedLinesOfCode: breakdown.lines_accepted,
          });
          languages.value.set(languageName, language);
        } else {
          // Update the existing Language object
          language.acceptedPrompts += breakdown.acceptances_count;
          language.suggestedLinesOfCode += breakdown.lines_suggested;
          language.acceptedLinesOfCode += breakdown.lines_accepted;
        }
        // Recalculate the acceptance rate
        language.acceptanceRate = language.suggestedLinesOfCode !== 0 ? (language.acceptedLinesOfCode / language.suggestedLinesOfCode) * 100 : 0;
      }));

      //Sort languages map by acceptance rate
      languages.value[Symbol.iterator] = function* () {
        yield* [...this.entries()].sort((a, b) => b[1].acceptanceRate - a[1].acceptanceRate);
      }

      // Get the top 5 languages by acceptance rate
      const top5LanguagesAcceptanceRate = new Map([...languages.value].slice(0, 5));

      languagesChartDataTop5AcceptanceRate.value = {
        labels: Array.from(top5LanguagesAcceptanceRate.values()).map(language => language.languageName),
        datasets: [
          {
            data: Array.from(top5LanguagesAcceptanceRate.values()).map(language => language.acceptanceRate.toFixed(2)),
            backgroundColor: pieChartColors.value,
          },
        ],
      };

      //Sort languages map by accepted prompts
      languages.value[Symbol.iterator] = function* () {
        yield* [...this.entries()].sort((a, b) => b[1].acceptedPrompts - a[1].acceptedPrompts);
      }

      languagesChartData.value = {
        labels: Array.from(languages.value.values()).map(language => language.languageName),
        datasets: [
          {
            data: Array.from(languages.value.values()).map(language => language.acceptedPrompts),
            backgroundColor: pieChartColors.value,
          },
        ],
      };

      // Get the top 5 languages by accepted prompts
      const top5LanguagesAcceptedPrompts = new Map([...languages.value].slice(0, 5));
      
      languagesChartDataTop5AcceptedPrompts.value = {
        labels: Array.from(top5LanguagesAcceptedPrompts.values()).map(language => language.languageName),
        datasets: [
          {
            data: Array.from(top5LanguagesAcceptedPrompts.values()).map(language => language.acceptedPrompts),
            backgroundColor: pieChartColors.value,
          },
        ],
      };

      numberOfLanguages.value = languages.value.size;
  
      return { chartOptions, languages, numberOfLanguages, 
        languagesChartData, languagesChartDataTop5AcceptedPrompts, languagesChartDataTop5AcceptanceRate };
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
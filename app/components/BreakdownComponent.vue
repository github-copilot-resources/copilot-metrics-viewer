<template>
  <div>
    <div class="tiles-container">
      <v-card elevation="2" class="my-3">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-25"/>
              <div class="text-h6 mb-1">Number of {{ breakdownDisplayNamePlural }}</div>
              <div class="text-caption">
                {{ dateRangeDescription }}
              </div>
              <p class="text-h4">{{ numberOfBreakdowns }}</p> 
          </div>
        </v-card-item>
      </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">
      <v-container style="min-height: 300px;" class="px-4 elevation-2">

        <!-- ── Enhanced view from new API reportData ────────────────────── -->
        <template v-if="useEnhancedView">
          <!-- Tab intro panel -->
          <v-card variant="outlined" class="mb-4 pa-3" density="compact">
            <template v-if="breakdownKey === 'language'">
              <div class="font-weight-bold text-body-1 mb-1">💬 Languages Deep-Dive</div>
              <div class="text-medium-emphasis text-body-2 mb-2">
                Understand <em>where</em> Copilot helps your team write code. Unlike the Organization tab (which shows overall usage trends), this tab breaks down impact by programming language — helping you identify which languages benefit most from AI assistance.
              </div>
              <div class="text-body-2 text-medium-emphasis">
                <strong>What's included:</strong> all language-attributed code-generating features — inline completions, agent edits, inline chat, and agent mode. A language only appears if Copilot generated code in it.
              </div>
            </template>
            <template v-else>
              <div class="font-weight-bold text-body-1 mb-1">🖥️ Editors Deep-Dive</div>
              <div class="text-medium-emphasis text-body-2 mb-2">
                See exactly <em>how</em> your team accesses Copilot. This tab shows every surface where Copilot was used — VS Code, JetBrains, Neovim, the CLI terminal, GitHub.com, and more. Use it to understand IDE adoption, terminal usage, and whether developers are using newer agentic workflows.
              </div>
              <div class="text-body-2 text-medium-emphasis">
                <strong>Note:</strong> Code acceptance rates apply only to IDE inline completions. CLI interactions (session/request counts) and GitHub.com activity are shown separately and don't produce acceptance metrics.
              </div>
            </template>
          </v-card>

          <!-- CLI summary card (editors tab only) -->
          <v-card v-if="breakdownKey === 'editor' && cliSummary" class="mb-4 pa-3" color="surface-variant" variant="tonal">
            <div class="text-subtitle-1 font-weight-bold mb-2">
              <v-icon size="small" class="mr-1">mdi-console</v-icon>CLI (GitHub Copilot in the CLI)
            </div>
            <v-row dense>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">Sessions</div>
                <div class="text-h6">{{ cliSummary.session_count }}</div>
              </v-col>
              <v-col cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">Requests</div>
                <div class="text-h6">{{ cliSummary.request_count }}</div>
              </v-col>
              <v-col v-if="cliSummary.avg_tokens_per_request" cols="6" sm="3">
                <div class="text-caption text-medium-emphasis">Avg tokens/request</div>
                <div class="text-h6">{{ cliSummary.avg_tokens_per_request }}</div>
              </v-col>
            </v-row>
          </v-card>

          <!-- Pie chart: share of code generation by language/editor -->
          <v-row>
            <v-col cols="12" md="6">
              <v-card>
                <v-card-item class="d-flex justify-center align-center">
                  <div class="text-h6 mb-1">Top 5 {{ breakdownDisplayNamePlural }} by code generations</div>
                  <div style="width: 300px; height: 300px;">
                    <Pie :data="enhancedChartDataTop5Generations" :options="chartOptions" />
                  </div>
                </v-card-item>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card>
                <v-card-item class="d-flex justify-center align-center">
                  <div class="text-h6 mb-1">Top 5 {{ breakdownDisplayNamePlural }} by lines added</div>
                  <div style="width: 300px; height: 300px;">
                    <Pie :data="enhancedChartDataTop5LinesAdded" :options="chartOptions" />
                  </div>
                </v-card-item>
              </v-card>
            </v-col>
          </v-row>

          <br>
          <h2>{{ breakdownDisplayNamePlural }} Breakdown (all features)</h2>
          <br>

          <!-- Language enhanced table -->
          <v-data-table
            v-if="breakdownKey === 'language'"
            :headers="enhancedLanguageHeaders"
            :items="enhancedLanguageList"
            class="elevation-2"
          >
            <template #item="{ item }">
              <tr>
                <td>{{ item.language }}</td>
                <td>{{ item.codeGenerations }}</td>
                <td>{{ item.codeAcceptances }}</td>
                <td>{{ item.linesGenerated }}</td>
                <td>{{ item.linesAdded }}</td>
                <td>
                  <v-chip
                    v-for="f in item.features"
                    :key="f"
                    size="x-small"
                    class="mr-1"
                    variant="tonal"
                  >{{ f }}</v-chip>
                </td>
              </tr>
            </template>
          </v-data-table>

          <!-- Editor enhanced table -->
          <v-data-table
            v-if="breakdownKey === 'editor'"
            :headers="enhancedEditorHeaders"
            :items="enhancedEditorList"
            class="elevation-2"
          >
            <template #item="{ item }">
              <tr>
                <td>{{ item.ide }}</td>
                <td>{{ item.interactions }}</td>
                <td>{{ item.codeGenerations }}</td>
                <td>{{ item.codeAcceptances }}</td>
                <td>{{ item.linesGenerated }}</td>
                <td>{{ item.linesAdded }}</td>
              </tr>
            </template>
          </v-data-table>
        </template>

        <!-- ── Legacy view (IDE code completions only) ───────────────────── -->
        <template v-else>
          <v-alert type="warning" variant="tonal" icon="mdi-alert-outline" class="mb-4" density="compact">
            Showing IDE inline code completions only. Install the new Copilot metrics API to see data across all features.
          </v-alert>

          <v-row>
            <v-col cols="4">
              <v-card>
                <v-card-item class="d-flex justify-center align-center">
                  <div class="spacing-25"/>
                  <div class="text-h6 mb-1">Top 5 {{ breakdownDisplayNamePlural }} by accepted code completions</div>
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

          <v-data-table :headers="headers" :items="breakdownList" class="elevation-2" style="padding-left: 100px; padding-right: 100px;">
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
        </template>

      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watch, computed, type PropType } from 'vue';
import type { Metrics } from '@/model/Metrics';
import { Breakdown } from '@/model/Breakdown';
import { Pie } from 'vue-chartjs'
import type { ReportDayTotals, ReportCliTotals } from '../../server/services/github-copilot-usage-api';

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

interface EnhancedLanguageRow {
  language: string;
  codeGenerations: number;
  codeAcceptances: number;
  linesGenerated: number;
  linesAdded: number;
  features: string[];
}

interface EnhancedEditorRow {
  ide: string;
  interactions: number;
  codeGenerations: number;
  codeAcceptances: number;
  linesGenerated: number;
  linesAdded: number;
}

interface CliSummary {
  session_count: number;
  request_count: number;
  avg_tokens_per_request?: number;
}

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
      },
      dateRangeDescription: {
          type: String,
          default: 'Over the last 28 days'
      },
      reportData: {
          type: Array as PropType<ReportDayTotals[]>,
          default: () => []
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

    // ── Enhanced view data ─────────────────────────────────────────────

    const enhancedLanguageList = ref<EnhancedLanguageRow[]>([]);
    const enhancedEditorList = ref<EnhancedEditorRow[]>([]);
    const cliSummary = ref<CliSummary | null>(null);
    const enhancedChartDataTop5Generations = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const enhancedChartDataTop5LinesAdded = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    // Whether to show enhanced view: only when relevant new-API slice is populated
    const useEnhancedView = computed(() => {
      const data = toRef(props, 'reportData').value;
      if (!data || data.length === 0) return false;
      if (props.breakdownKey === 'language') {
        return data.some(d => d.totals_by_language_feature && d.totals_by_language_feature.length > 0);
      }
      if (props.breakdownKey === 'editor') {
        return data.some(d => d.totals_by_ide && d.totals_by_ide.length > 0);
      }
      return false;
    });

    // Process enhanced language data from reportData
    const processEnhancedLanguageData = (data: ReportDayTotals[]) => {
      const langMap = new Map<string, EnhancedLanguageRow>();
      data.forEach(day => {
        (day.totals_by_language_feature || []).forEach(entry => {
          const key = entry.language;
          if (!langMap.has(key)) {
            langMap.set(key, { language: key, codeGenerations: 0, codeAcceptances: 0, linesGenerated: 0, linesAdded: 0, features: [] });
          }
          const row = langMap.get(key)!;
          row.codeGenerations += entry.code_generation_activity_count || 0;
          row.codeAcceptances += entry.code_acceptance_activity_count || 0;
          row.linesGenerated += entry.loc_suggested_to_add_sum || 0;
          row.linesAdded += entry.loc_added_sum || 0;
          if (!row.features.includes(entry.feature)) {
            row.features.push(entry.feature);
          }
        });
      });

      const sorted = Array.from(langMap.values()).sort((a, b) => b.codeGenerations - a.codeGenerations);
      enhancedLanguageList.value = sorted;
      numberOfBreakdowns.value = sorted.length;

      const top5 = sorted.slice(0, 5);
      enhancedChartDataTop5Generations.value = {
        labels: top5.map(r => r.language),
        datasets: [{ data: top5.map(r => r.codeGenerations), backgroundColor: pieChartColors.value }]
      };
      enhancedChartDataTop5LinesAdded.value = {
        labels: top5.map(r => r.language),
        datasets: [{ data: top5.map(r => r.linesAdded), backgroundColor: pieChartColors.value }]
      };
    };

    // Process enhanced editor data from reportData
    const processEnhancedEditorData = (data: ReportDayTotals[]) => {
      const ideMap = new Map<string, EnhancedEditorRow>();
      let cliSessions = 0, cliRequests = 0, cliAvgTokens: number | undefined;

      data.forEach(day => {
        (day.totals_by_ide || []).forEach(entry => {
          const key = entry.ide;
          if (!ideMap.has(key)) {
            ideMap.set(key, { ide: key, interactions: 0, codeGenerations: 0, codeAcceptances: 0, linesGenerated: 0, linesAdded: 0 });
          }
          const row = ideMap.get(key)!;
          row.interactions += entry.user_initiated_interaction_count || 0;
          row.codeGenerations += entry.code_generation_activity_count || 0;
          row.codeAcceptances += entry.code_acceptance_activity_count || 0;
          row.linesGenerated += entry.loc_suggested_to_add_sum || 0;
          row.linesAdded += entry.loc_added_sum || 0;
        });

        if (day.totals_by_cli) {
          cliSessions += day.totals_by_cli.session_count || 0;
          cliRequests += day.totals_by_cli.request_count || 0;
          if (day.totals_by_cli.token_usage?.avg_tokens_per_request) {
            cliAvgTokens = day.totals_by_cli.token_usage.avg_tokens_per_request;
          }
        }
      });

      const sorted = Array.from(ideMap.values()).sort((a, b) => b.codeGenerations - a.codeGenerations);
      enhancedEditorList.value = sorted;
      numberOfBreakdowns.value = sorted.length + (cliSessions > 0 ? 1 : 0);

      cliSummary.value = cliSessions > 0 ? { session_count: cliSessions, request_count: cliRequests, avg_tokens_per_request: cliAvgTokens } : null;

      const top5 = sorted.slice(0, 5);
      enhancedChartDataTop5Generations.value = {
        labels: top5.map(r => r.ide),
        datasets: [{ data: top5.map(r => r.codeGenerations), backgroundColor: pieChartColors.value }]
      };
      enhancedChartDataTop5LinesAdded.value = {
        labels: top5.map(r => r.ide),
        datasets: [{ data: top5.map(r => r.linesAdded), backgroundColor: pieChartColors.value }]
      };
    };

    // Function to process legacy breakdown data
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
          },
        ],
      };

      breakdownsChartDataTop5AcceptedPromptsByLines.value = {
        labels: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.name),
        datasets: [
          {
            data: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.acceptanceRateByLines.toFixed(2)),
            backgroundColor: pieChartColors.value,
          },
        ],
      };

      breakdownsChartDataTop5AcceptedPromptsByCounts.value = {
        labels: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.name),
        datasets: [
          {
            data: top5BreakdownsAcceptedPrompts.map(breakdown => breakdown.acceptanceRateByCount.toFixed(2)),
            backgroundColor: pieChartColors.value,
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

    // Watch for changes in reportData and re-process enhanced data
    watch(() => props.reportData, (newReportData) => {
      if (!newReportData || newReportData.length === 0) return;
      if (props.breakdownKey === 'language') {
        processEnhancedLanguageData(newReportData);
      } else if (props.breakdownKey === 'editor') {
        processEnhancedEditorData(newReportData);
      }
    }, { immediate: true, deep: true });

    return { chartOptions, breakdownList, numberOfBreakdowns, 
      breakdownsChartData, breakdownsChartDataTop5AcceptedPrompts, breakdownsChartDataTop5AcceptedPromptsByLines, breakdownsChartDataTop5AcceptedPromptsByCounts,
      useEnhancedView, enhancedLanguageList, enhancedEditorList, cliSummary,
      enhancedChartDataTop5Generations, enhancedChartDataTop5LinesAdded };
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
        { title: 'Accepted Completions', key: 'acceptedPrompts' },
        { title: 'Code Completions', key: 'suggestedPrompts' },
        { title: 'Accepted Lines of Code', key: 'acceptedLinesOfCode' },
        { title: 'Suggested Lines of Code', key: 'suggestedLinesOfCode' },
        { title: 'Acceptance Rate by Count (%)', key: 'acceptanceRateByCount' },
        { title: 'Acceptance Rate by Lines (%)', key: 'acceptanceRateByLines' },
      ];
    },
    enhancedLanguageHeaders() {
      return [
        { title: 'Language', key: 'language' },
        { title: 'Code Generations', key: 'codeGenerations' },
        { title: 'Code Acceptances', key: 'codeAcceptances' },
        { title: 'Lines Generated', key: 'linesGenerated' },
        { title: 'Lines Added', key: 'linesAdded' },
        { title: 'Active Features', key: 'features', sortable: false },
      ];
    },
    enhancedEditorHeaders() {
      return [
        { title: 'Editor / IDE', key: 'ide' },
        { title: 'Interactions', key: 'interactions' },
        { title: 'Code Generations', key: 'codeGenerations' },
        { title: 'Code Acceptances', key: 'codeAcceptances' },
        { title: 'Lines Generated', key: 'linesGenerated' },
        { title: 'Lines Added', key: 'linesAdded' },
      ];
    },
  },
  

});
</script>

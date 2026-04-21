<template>
  <div>
    <!-- ── Description card — always at the very top ── -->
    <template v-if="useEnhancedView">
      <v-card variant="outlined" class="mx-4 mt-3 mb-4 pa-3" density="compact">
        <template v-if="breakdownKey === 'language'">
          <div class="font-weight-bold text-body-1 mb-1">💬 Languages Deep-Dive</div>
          <div class="text-medium-emphasis text-body-2">
            Understand <em>where</em> Copilot helps your team write code. This tab breaks down impact by programming language — helping you identify which languages benefit most from AI assistance.
            A language only appears if Copilot generated code in it.
          </div>
        </template>
        <template v-else>
          <div class="font-weight-bold text-body-1 mb-1">🖥️ Editors Deep-Dive</div>
          <div class="text-medium-emphasis text-body-2">
            See exactly <em>how</em> your team accesses Copilot — VS Code, JetBrains, Neovim, CLI terminal, and more.
            Code acceptance rates apply only to IDE inline completions; CLI interactions are shown separately.
          </div>
        </template>
      </v-card>
    </template>

    <!-- ── KPI tiles ── -->
    <div class="tiles-container">
      <v-card elevation="2" class="my-3">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-25"/>
              <div class="text-h6 mb-1">Number of {{ breakdownDisplayNamePlural }}</div>
              <div class="text-caption text-medium-emphasis">
                {{ dateRangeDescription }}
              </div>
              <p class="kpi-value text-primary mt-1">{{ numberOfBreakdowns }}</p>
          </div>
        </v-card-item>
      </v-card>
      <!-- Top Language/Editor summary tile (enhanced view only) -->
      <v-card v-if="useEnhancedView && topItemName" elevation="4" color="surface" variant="elevated" class="my-3">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-25"/>
            <div class="text-h6 mb-1">Top {{ breakdownDisplayName }}</div>
            <div class="text-caption text-medium-emphasis">Most code generations</div>
            <p class="kpi-value text-primary mt-1" style="word-break: break-word;">{{ topItemName }}</p>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <!-- ── Enhanced view from new API reportData ────────────────────── -->
    <template v-if="useEnhancedView">
      <v-container :fluid="chartColumns === 'full'" :class="[chartColumns === 'full' ? 'px-0' : 'px-4']">
      <div class="d-flex justify-end mb-2">
        <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
          <v-btn value="1" size="small" icon="mdi-view-agenda" title="Single column" />
          <v-btn value="2" size="small" icon="mdi-view-grid" title="Two columns" />
          <v-btn value="full" size="small" icon="mdi-fullscreen" title="Full width" />
        </v-btn-toggle>
      </div>
      <!-- CLI summary card (editors tab only) -->
      <v-card v-if="breakdownKey === 'editor' && cliSummary" class="mx-0 mb-4 pa-3" color="surface-variant" variant="tonal">
        <div class="text-subtitle-1 font-weight-bold mb-2">
          <v-icon size="small" class="mr-1">mdi-console</v-icon>CLI (GitHub Copilot in the CLI)
        </div>
        <v-row dense>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">Sessions</div>
            <div class="text-h6 text-primary">{{ cliSummary.session_count }}</div>
          </v-col>
          <v-col cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">Requests</div>
            <div class="text-h6 text-primary">{{ cliSummary.request_count }}</div>
          </v-col>
          <v-col v-if="cliSummary.avg_tokens_per_request" cols="6" sm="3">
            <div class="text-caption text-medium-emphasis">Avg tokens/request</div>
            <div class="text-h6 text-info">{{ cliSummary.avg_tokens_per_request }}</div>
          </v-col>
        </v-row>
      </v-card>

      <!-- Bar charts: top 5 by code generations and lines added -->
      <v-row class="mb-4">

      <!-- Usage per day (stacked 100% area — full width) -->
      <v-col v-if="usagePerDayChartData.labels.length > 1" cols="12">
        <v-card variant="elevated" elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">
            {{ breakdownKey === 'language' ? 'Language' : 'Editor' }} usage per day
          </v-card-title>
          <v-card-subtitle class="px-4 pb-1">
            Daily share of code generations per {{ breakdownKey }} · <span class="font-italic">Shaded columns = weekends</span>
          </v-card-subtitle>
          <v-card-text>
            <div style="height:260px">
              <LineChart :data="usagePerDayChartData" :options="stackedAreaOptions" :plugins="[gradientFillPlugin, weekendPlugin]" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Distribution donut | Model per language (or Acceptance rate by editor) -->
      <v-col v-if="distributionDonutData.labels.length" cols="12" :md="chartColumns === '2' ? 6 : 12">
        <v-card variant="elevated" elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">
            {{ breakdownKey === 'language' ? 'Language' : 'Editor' }} distribution
          </v-card-title>
          <v-card-subtitle class="px-4 pb-1">Total code generations share across all days</v-card-subtitle>
          <v-card-text>
            <div style="height:260px">
              <Doughnut :data="distributionDonutData" :options="donutOptions" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col v-if="breakdownKey === 'language' && modelPerLangChartData.labels.length" cols="12" :md="chartColumns === '2' ? 6 : 12">
        <v-card variant="elevated" elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Model usage per language</v-card-title>
          <v-card-subtitle class="px-4 pb-1">Top 8 languages — code generations per model</v-card-subtitle>
          <v-card-text>
            <div style="height:260px">
              <Bar :data="modelPerLangChartData" :options="groupedBarOptions" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>
      <v-col v-if="breakdownKey === 'editor' && acceptanceRateByEditorData.labels.length" cols="12" :md="chartColumns === '2' ? 6 : 12">
        <v-card variant="elevated" elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Acceptance rate by editor</v-card-title>
          <v-card-subtitle class="px-4 pb-1">Code acceptances ÷ code generations per IDE/editor</v-card-subtitle>
          <v-card-text>
            <div style="height:260px">
              <Bar :data="acceptanceRateByEditorData" :options="{ ...horizBarOptions, scales: { x: { beginAtZero: true, max: 100, ticks: { callback: (v: any) => `${v}%` } } } }" />
            </div>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Top 5 by code generations and lines added -->
        <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
          <v-card variant="elevated" elevation="2">
            <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Top 5 {{ breakdownDisplayNamePlural }} by code generations</v-card-title>
            <v-card-text>
              <div style="height:220px">
                <Bar :data="enhancedChartDataTop5Generations" :options="horizBarOptions" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
        <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
          <v-card variant="elevated" elevation="2">
            <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Top 5 {{ breakdownDisplayNamePlural }} by lines added</v-card-title>
            <v-card-text>
              <div style="height:220px">
                <Bar :data="enhancedChartDataTop5LinesAdded" :options="horizBarOptions" />
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <div :class="['mb-4', chartColumns !== 'full' ? 'mx-4' : '']">
        <v-card variant="elevated" elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">{{ breakdownDisplayNamePlural }} Breakdown (all features)</v-card-title>
          <v-card-text class="pa-0">

          <!-- Language enhanced table -->
          <v-data-table
            v-if="breakdownKey === 'language'"
            :headers="enhancedLanguageHeaders"
            :items="enhancedLanguageList"
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
                    :color="featureChipColor(f)"
                    :variant="featureChipVariant(f)"
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

          </v-card-text>
        </v-card>
      </div>

      <!-- Top Contributors per Language (full-width, below breakdown table) -->
      <v-row v-if="breakdownKey === 'language' && topUsersPerLanguage.size > 0" class="mb-4">
        <v-col cols="12">
          <v-card variant="elevated" elevation="2">
            <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Top Contributors per Language</v-card-title>
            <v-card-subtitle class="px-4 pb-1">Top 3 users by code generations · top 15 languages</v-card-subtitle>
            <v-card-text class="pa-0">
              <v-table density="compact">
                <thead>
                  <tr>
                    <th class="text-left pl-4">Language</th>
                    <th class="text-left">🥇 Top User</th>
                    <th class="text-left">🥈</th>
                    <th class="text-left">🥉</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in enhancedLanguageList.slice(0, 15)" :key="row.language">
                    <td class="pl-4 text-caption font-weight-medium">{{ row.language }}</td>
                    <td v-for="rank in 3" :key="rank" class="text-caption">
                      <template v-if="topUsersPerLanguage.get(row.language)?.[rank - 1]">
                        <span class="font-weight-medium">{{ topUsersPerLanguage.get(row.language)![rank - 1].login }}</span>
                        <span class="text-medium-emphasis ml-1">({{ topUsersPerLanguage.get(row.language)![rank - 1].gen }})</span>
                      </template>
                      <span v-else class="text-disabled">—</span>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- Top Contributors per Editor (full-width, below breakdown table) -->
      <v-row v-if="breakdownKey === 'editor' && topUsersPerEditor.size > 0" class="mb-4">
        <v-col cols="12">
          <v-card variant="elevated" elevation="2">
            <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Top Contributors per Editor</v-card-title>
            <v-card-subtitle class="px-4 pb-1">Top 3 users by code generations for each IDE/editor</v-card-subtitle>
            <v-card-text class="pa-0">
              <v-table density="compact">
                <thead>
                  <tr>
                    <th class="text-left pl-4">Editor / IDE</th>
                    <th class="text-left">🥇 Top User</th>
                    <th class="text-left">🥈</th>
                    <th class="text-left">🥉</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in enhancedEditorList" :key="row.ide">
                    <td class="pl-4 text-caption font-weight-medium">{{ row.ide }}</td>
                    <td v-for="rank in 3" :key="rank" class="text-caption">
                      <template v-if="topUsersPerEditor.get(row.ide)?.[rank - 1]">
                        <span class="font-weight-medium">{{ topUsersPerEditor.get(row.ide)![rank - 1].login }}</span>
                        <span class="text-medium-emphasis ml-1">({{ topUsersPerEditor.get(row.ide)![rank - 1].gen }})</span>
                      </template>
                      <span v-else class="text-disabled">—</span>
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
      </v-container>
    </template>
    <template v-else>
      <div :class="['mb-4', chartColumns !== 'full' ? 'mx-4' : '']">
        <v-alert type="warning" variant="tonal" icon="mdi-alert-outline" class="mb-4" density="compact">
          Showing IDE inline code completions only. Install the new Copilot metrics API to see data across all features.
        </v-alert>

        <v-row class="mb-4">
          <v-col cols="12" md="4">
            <v-card variant="elevated" elevation="2">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Top 5 {{ breakdownDisplayNamePlural }} by accepted completions</v-card-title>
              <v-card-text class="d-flex justify-center">
                <div style="width: 280px; height: 280px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPrompts" :options="chartOptions" />
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card variant="elevated" elevation="2">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Acceptance Rate (by count) Top 5</v-card-title>
              <v-card-text class="d-flex justify-center">
                <div style="width: 280px; height: 280px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPromptsByCounts" :options="chartOptions" />
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="4">
            <v-card variant="elevated" elevation="2">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Acceptance Rate (by lines) Top 5</v-card-title>
              <v-card-text class="d-flex justify-center">
                <div style="width: 280px; height: 280px;">
                  <Pie :data="breakdownsChartDataTop5AcceptedPromptsByLines" :options="chartOptions" />
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>

        <v-card variant="elevated" elevation="2">
          <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">{{ breakdownDisplayNamePlural }} Breakdown</v-card-title>
          <v-card-text class="pa-0">
            <v-data-table :headers="headers" :items="breakdownList">
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
          </v-card-text>
        </v-card>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watch, computed, type PropType } from 'vue';
import type { Metrics } from '@/model/Metrics';
import { Breakdown } from '@/model/Breakdown';
import { Pie, Bar, Doughnut, Line as LineChart } from 'vue-chartjs'
import type { ReportDayTotals, ReportCliTotals, UserTotals } from '../../server/services/github-copilot-usage-api';
import { PALETTE, PIE_COLORS, weekendPlugin, gradientFillPlugin } from '@/utils/chartPlugins';

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
  Legend,
  Filler
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
  Legend,
  Filler
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
    Pie, Bar, Doughnut, LineChart
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
      },
      userMetrics: {
          type: Array as PropType<UserTotals[]>,
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

    // Horizontal bar chart options for the enhanced top-5 charts
    const horizBarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
      plugins: { legend: { display: false } },
      scales: { x: { beginAtZero: true } },
    };

    // Stacked 100% area chart (usage per day)
    const stackedAreaOptions = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index' as const, intersect: false },
      plugins: { legend: { position: 'bottom' as const } },
      scales: {
        x: { stacked: true, ticks: { maxTicksLimit: 10 } },
        y: { stacked: true, min: 0, max: 100, ticks: { callback: (v: any) => `${v}%` } },
      },
    };

    // Doughnut distribution chart
    const donutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' as const } },
    };

    // Grouped bar for model-per-language / acceptance rate
    const groupedBarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom' as const } },
      scales: { x: { ticks: { maxTicksLimit: 10 } }, y: { beginAtZero: true } },
    };

    const paletteColors = PALETTE.slice(0, 8);
    const pieChartColors = computed(() => PIE_COLORS);

    // ── Enhanced view data ─────────────────────────────────────────────

    const enhancedLanguageList = ref<EnhancedLanguageRow[]>([]);
    const enhancedEditorList = ref<EnhancedEditorRow[]>([]);
    const cliSummary = ref<CliSummary | null>(null);
    const enhancedChartDataTop5Generations = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const enhancedChartDataTop5LinesAdded = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    // Charts shared between language and editor tabs (populated by the active branch)
    const usagePerDayChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const distributionDonutData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    // Language-only chart
    const modelPerLangChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    // Editor-only chart
    const acceptanceRateByEditorData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

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
        datasets: [{ label: 'Code Generations', data: top5.map(r => r.codeGenerations), backgroundColor: paletteColors.map(p => p.bg), borderColor: paletteColors.map(p => p.border), borderWidth: 1 }]
      };
      enhancedChartDataTop5LinesAdded.value = {
        labels: top5.map(r => r.language),
        datasets: [{ label: 'Lines Added', data: top5.map(r => r.linesAdded), backgroundColor: paletteColors.map(p => p.bg), borderColor: paletteColors.map(p => p.border), borderWidth: 1 }]
      };

      // ── Language usage per day (100% stacked area) ─────────────────────
      const labels = data.map(d => d.day ?? '');
      const langActByDay: Record<string, number[]> = {};
      const langDayTotals = data.map(() => 0);
      data.forEach((d, idx) => {
        (d.totals_by_language_feature || []).forEach(lf => {
          const lang = lf.language ?? 'Unknown';
          if (!langActByDay[lang]) langActByDay[lang] = data.map(() => 0);
          const cnt = lf.code_generation_activity_count ?? 0;
          langActByDay[lang][idx] += cnt;
          langDayTotals[idx] += cnt;
        });
      });
      const allLangsSorted = Object.entries(langActByDay).sort((a, b) =>
        b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0));
      const top5Langs = allLangsSorted.slice(0, 5);
      const otherLangsData = allLangsSorted.slice(5).reduce(
        (acc, [, vals]) => acc.map((v, i) => v + vals[i]),
        data.map(() => 0)
      );
      usagePerDayChartData.value = {
        labels,
        datasets: [
          ...top5Langs.map(([lang, vals], i) => ({
            label: lang,
            data: vals.map((v, idx) => langDayTotals[idx] > 0 ? parseFloat((v / langDayTotals[idx] * 100).toFixed(2)) : 0),
            backgroundColor: PALETTE[i % PALETTE.length].bg,
            borderColor: PALETTE[i % PALETTE.length].border,
            fill: 'stack' as const,
            tension: 0.3,
          })),
          ...(allLangsSorted.length > 5 ? [{
            label: 'Other',
            data: otherLangsData.map((v, idx) => langDayTotals[idx] > 0 ? parseFloat((v / langDayTotals[idx] * 100).toFixed(2)) : 0),
            backgroundColor: PALETTE[5 % PALETTE.length].bg,
            borderColor: PALETTE[5 % PALETTE.length].border,
            fill: 'stack' as const,
            tension: 0.3,
          }] : []),
        ]
      };

      // ── Language distribution donut ─────────────────────────────────────
      const langAgg = allLangsSorted.map(([lang, vals]) => ({ lang, total: vals.reduce((s, v) => s + v, 0) }));
      distributionDonutData.value = {
        labels: langAgg.map(l => l.lang),
        datasets: [{
          data: langAgg.map(l => l.total),
          backgroundColor: langAgg.map((_, i) => PALETTE[i % PALETTE.length].bg),
          borderColor: langAgg.map((_, i) => PALETTE[i % PALETTE.length].border),
        }],
      };

      // ── Model per language (stacked bar from totals_by_language_model) ──
      const langModelMatrix: Record<string, Record<string, number>> = {};
      data.forEach(d => {
        (d.totals_by_language_model || []).forEach(lm => {
          const lang = lm.language ?? 'Unknown';
          const model = lm.model ?? 'Unknown';
          if (!langModelMatrix[lang]) langModelMatrix[lang] = {};
          langModelMatrix[lang][model] = (langModelMatrix[lang][model] ?? 0) + (lm.code_generation_activity_count ?? 0);
        });
      });
      const topLangLabels = allLangsSorted.slice(0, 8).map(([l]) => l);
      const modelKeys = [...new Set(Object.values(langModelMatrix).flatMap(m => Object.keys(m)))];
      modelPerLangChartData.value = {
        labels: topLangLabels,
        datasets: modelKeys.map((model, i) => ({
          label: model,
          data: topLangLabels.map(lang => langModelMatrix[lang]?.[model] ?? 0),
          backgroundColor: PALETTE[i % PALETTE.length].bg,
          borderColor: PALETTE[i % PALETTE.length].border,
        })),
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

      // Inject CLI as a synthetic "editor" row so it appears in the same table and charts
      const allRows: EnhancedEditorRow[] = [...sorted];
      if (cliRequests > 0) {
        allRows.push({
          ide: 'CLI (copilot_cli)',
          interactions: cliRequests,
          codeGenerations: cliRequests,
          codeAcceptances: 0,
          linesGenerated: 0,
          linesAdded: 0,
        });
        allRows.sort((a, b) => b.interactions - a.interactions);
      }

      enhancedEditorList.value = allRows;
      numberOfBreakdowns.value = allRows.length;

      cliSummary.value = cliSessions > 0 ? { session_count: cliSessions, request_count: cliRequests, avg_tokens_per_request: cliAvgTokens } : null;

      const top5 = allRows.slice(0, 5);
      enhancedChartDataTop5Generations.value = {
        labels: top5.map(r => r.ide),
        datasets: [{ label: 'Interactions', data: top5.map(r => r.interactions || r.codeGenerations), backgroundColor: paletteColors.map(p => p.bg), borderColor: paletteColors.map(p => p.border), borderWidth: 1 }]
      };
      enhancedChartDataTop5LinesAdded.value = {
        labels: top5.map(r => r.ide),
        datasets: [{ label: 'Lines Added', data: top5.map(r => r.linesAdded), backgroundColor: paletteColors.map(p => p.bg), borderColor: paletteColors.map(p => p.border), borderWidth: 1 }]
      };

      // ── Editor usage per day (100% stacked area) ────────────────────────
      const labels = data.map(d => d.day ?? '');
      const ideActByDay: Record<string, number[]> = {};
      const ideDayTotals = data.map(() => 0);
      data.forEach((d, idx) => {
        (d.totals_by_ide || []).forEach(entry => {
          const ide = entry.ide;
          if (!ideActByDay[ide]) ideActByDay[ide] = data.map(() => 0);
          const cnt = entry.code_generation_activity_count ?? 0;
          ideActByDay[ide][idx] += cnt;
          ideDayTotals[idx] += cnt;
        });
      });
      const allIdesSorted = Object.entries(ideActByDay).sort((a, b) =>
        b[1].reduce((s, v) => s + v, 0) - a[1].reduce((s, v) => s + v, 0));
      usagePerDayChartData.value = {
        labels,
        datasets: allIdesSorted.map(([ide, vals], i) => ({
          label: ide,
          data: vals.map((v, idx) => ideDayTotals[idx] > 0 ? parseFloat((v / ideDayTotals[idx] * 100).toFixed(2)) : 0),
          backgroundColor: PALETTE[i % PALETTE.length].bg,
          borderColor: PALETTE[i % PALETTE.length].border,
          fill: 'stack' as const,
          tension: 0.3,
        })),
      };

      // ── Editor distribution donut ────────────────────────────────────────
      const ideAgg = allIdesSorted.map(([ide, vals]) => ({ ide, total: vals.reduce((s, v) => s + v, 0) }));
      distributionDonutData.value = {
        labels: ideAgg.map(l => l.ide),
        datasets: [{
          data: ideAgg.map(l => l.total),
          backgroundColor: ideAgg.map((_, i) => PALETTE[i % PALETTE.length].bg),
          borderColor: ideAgg.map((_, i) => PALETTE[i % PALETTE.length].border),
        }],
      };

      // ── Acceptance rate by editor (horizontal bar) ───────────────────────
      acceptanceRateByEditorData.value = {
        labels: allRows.map(r => r.ide),
        datasets: [{
          label: 'Acceptance Rate (%)',
          data: allRows.map(r => r.codeGenerations > 0 ? parseFloat((r.codeAcceptances / r.codeGenerations * 100).toFixed(1)) : 0),
          backgroundColor: paletteColors.map(p => p.bg),
          borderColor: paletteColors.map(p => p.border),
          borderWidth: 1,
        }],
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

    // Top 3 users per language — computed so it updates when userMetrics arrive later
    const topUsersPerLanguage = computed(() => {
      const result = new Map<string, { login: string; gen: number }[]>();
      const users = props.userMetrics || [];
      if (!users.length) return result;
      users.forEach(user => {
        (user.totals_by_language_feature || []).forEach(lf => {
          const gen = lf.code_generation_activity_count || 0;
          if (gen <= 0) return;
          if (!result.has(lf.language)) result.set(lf.language, []);
          const arr = result.get(lf.language)!;
          const existing = arr.find(u => u.login === user.login);
          if (existing) {
            existing.gen += gen;
          } else {
            arr.push({ login: user.login, gen });
          }
        });
      });
      // Sort each language descending and keep top 3
      result.forEach(arr => arr.sort((a, b) => b.gen - a.gen).splice(3));
      return result;
    });

    // Top 3 users per editor
    const topUsersPerEditor = computed(() => {
      const result = new Map<string, { login: string; gen: number }[]>();
      const users = props.userMetrics || [];
      if (!users.length) return result;
      users.forEach(user => {
        (user.totals_by_ide || []).forEach(ie => {
          const gen = (ie as any).code_generation_activity_count || 0;
          if (gen <= 0) return;
          const ideName = (ie as any).ide as string;
          if (!result.has(ideName)) result.set(ideName, []);
          const arr = result.get(ideName)!;
          const existing = arr.find(u => u.login === user.login);
          if (existing) {
            existing.gen += gen;
          } else {
            arr.push({ login: user.login, gen });
          }
        });
      });
      result.forEach(arr => arr.sort((a, b) => b.gen - a.gen).splice(3));
      return result;
    });

    return { chartOptions, horizBarOptions, stackedAreaOptions, donutOptions, groupedBarOptions,
      breakdownList, numberOfBreakdowns,
      breakdownsChartData, breakdownsChartDataTop5AcceptedPrompts, breakdownsChartDataTop5AcceptedPromptsByLines, breakdownsChartDataTop5AcceptedPromptsByCounts,
      pieChartColors,
      useEnhancedView, enhancedLanguageList, enhancedEditorList, cliSummary,
      enhancedChartDataTop5Generations, enhancedChartDataTop5LinesAdded,
      usagePerDayChartData, distributionDonutData, modelPerLangChartData, acceptanceRateByEditorData,
      topUsersPerLanguage, topUsersPerEditor,
      weekendPlugin, gradientFillPlugin,
    };
  },
  data() {
    return { chartColumns: '2' };
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
    topItemName(): string {
      if (this.breakdownKey === 'language' && this.enhancedLanguageList.length > 0) {
        return this.enhancedLanguageList[0].language;
      }
      if (this.breakdownKey === 'editor' && this.enhancedEditorList.length > 0) {
        return this.enhancedEditorList[0].ide.replace(/\s*\(copilot_cli\)/, '');
      }
      return '';
    },
  },
  methods: {
    featureChipColor(feature: string): string {
      // Feature IDs from new Copilot metrics API
      const map: Record<string, string> = {
        'code_completion':           'secondary',
        'copilot_ide_completions':   'secondary',
        'copilot_completions':       'secondary',
        'chat_panel_ask_mode':       'info',
        'chat_inline':               'info',
        'copilot_ide_chat':          'info',
        'copilot_inline_chat':       'info',
        'chat_panel_custom_mode':    'info',
        'copilot_edit':              'success',
        'copilot_ide_edit':          'success',
        'agent_edit':                'deep-orange',
        'copilot_ide_agent_edit':    'deep-orange',
        'chat_panel_agent_mode':     'primary',
        'copilot_ide_agent':         'primary',
        'copilot_agent':             'primary',
        'copilot_cli':               'teal',
        'others':                    'blue-grey',
      };
      return map[feature] || 'blue-grey';
    },
    featureChipVariant(feature: string): string {
      // Highlight agent_edit distinctly
      return (feature === 'agent_edit' || feature === 'copilot_ide_agent_edit') ? 'elevated' : 'tonal';
    },
  },
});
</script>

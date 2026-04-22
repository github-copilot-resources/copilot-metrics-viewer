<template>
  <div>
    <!-- Info header — same style as all other tabs -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-4 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">🔀 Pull Requests</div>
          <div class="text-medium-emphasis">
            Track pull request activity for the reporting period — created, reviewed, merged, and Copilot-authored PRs.
            Copilot coding agent can create PRs autonomously; Copilot code review provides AI-powered suggestions inline.
          </div>
        </div>
        <v-divider vertical class="mx-2 hidden-sm-and-down" />
        <div class="d-flex flex-column gap-1 flex-shrink-0">
          <div class="text-caption text-medium-emphasis font-weight-medium mb-1">LEARN MORE</div>
          <a href="https://docs.github.com/en/copilot/using-github-copilot/github-copilot-in-github-com/collaborating-with-pull-requests-using-copilot" target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Copilot for Pull Requests</span>
          </a>
          <a href="https://docs.github.com/en/copilot/using-github-copilot/code-review/using-copilot-code-review" target="_blank" rel="noopener"
             class="text-decoration-none d-flex align-center gap-1 text-body-2" style="color: inherit;">
            <v-icon size="x-small" color="primary">mdi-open-in-new</v-icon>
            <span class="text-primary">Copilot code review</span>
          </a>
        </div>
      </div>
    </v-card>

    <!-- KPI Tiles -->
    <div class="tiles-container">
      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="spacing-10"/>
                <div class="text-h6 mb-1">PRs Created</div>
                <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
                <p class="kpi-value text-primary">{{ totalCreated }}</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Total pull requests created during the reporting period. Includes PRs created by both developers and Copilot agents.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="spacing-10"/>
                <div class="text-h6 mb-1">PRs Reviewed</div>
                <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
                <p class="kpi-value text-info">{{ totalReviewed }}</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Pull requests that received at least one code review. Indicates team collaboration and code quality practices.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="spacing-10"/>
                <div class="text-h6 mb-1">PRs Merged</div>
                <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
                <p class="kpi-value text-success">{{ totalMerged }}</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Pull requests successfully merged into target branches. Represents completed work delivered to the codebase.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>

      <v-card elevation="4" color="surface" variant="elevated" class="my-2">
        <v-card-item>
          <v-tooltip location="bottom" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <div v-bind="props" class="tiles-text">
                <div class="spacing-10"/>
                <div class="text-h6 mb-1">Created by Copilot</div>
                <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
                <p class="kpi-value text-warning">{{ totalCreatedByCopilot }}</p>
              </div>
            </template>
            <v-card class="pa-3 metric-tooltip">
              <span class="tooltip-text">Pull requests created by Copilot coding agent. Shows automated code contributions from agent-driven workflows.</span>
            </v-card>
          </v-tooltip>
        </v-card-item>
      </v-card>
    </div>

    <!-- Charts -->
    <template v-if="hasPrData">
      <v-container :fluid="chartColumns === 'full'" :class="['elevation-2', chartColumns === 'full' ? 'px-0' : 'px-4']">
        <div class="d-flex justify-end mb-2">
          <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
            <v-btn value="1" size="small" icon="mdi-view-agenda" title="Single column" />
            <v-btn value="2" size="small" icon="mdi-view-grid" title="Two columns" />
            <v-btn value="full" size="small" icon="mdi-fullscreen" title="Full width" />
          </v-btn-toggle>
        </div>
        <v-row>
          <v-col cols="12">
            <v-card variant="elevated" elevation="2">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Pull Request Activity Over Time</v-card-title>
              <v-card-text>
                <div style="height:280px">
                  <Line :data="prActivityChartData" :options="lineOpts" :plugins="plugins" />
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
        <v-row class="mt-2">
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card variant="elevated" elevation="2">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Copilot PR Contributions</v-card-title>
              <v-card-text>
                <div style="height:280px">
                  <Bar :data="copilotPrChartData" :options="barOpts" :plugins="plugins" />
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card variant="elevated" elevation="2">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-3 px-4">Review Suggestions</v-card-title>
              <v-card-text>
                <div style="height:280px">
                  <Line :data="reviewSuggestionsChartData" :options="lineOpts" :plugins="plugins" />
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </template>

    <div v-else class="mx-4 mb-4">
      <v-alert type="info" density="compact" text="No pull request data available. PR metrics require organization-level API access." />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watchEffect, type PropType } from 'vue';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import { Line, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { PALETTE, weekendPlugin, gradientFillPlugin, makeLineOptions, makeBarOptions } from '@/utils/chartPlugins';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default defineComponent({
  name: 'PullRequestViewer',
  components: { Line, Bar },
  props: {
    reportData: { type: Array as PropType<ReportDayTotals[]>, required: true },
    dateRangeDescription: { type: String, default: 'Over the last 28 days' }
  },
  setup(props) {
    const totalCreated = ref(0);
    const totalReviewed = ref(0);
    const totalMerged = ref(0);
    const totalCreatedByCopilot = ref(0);
    const hasPrData = ref(false);
    const prActivityChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const copilotPrChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const reviewSuggestionsChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });

    const plugins = [weekendPlugin, gradientFillPlugin];
    const lineOpts = makeLineOptions({ scales: { x: { ticks: { maxTicksLimit: 14 } }, y: { beginAtZero: true, min: 0 } } });
    const barOpts  = makeBarOptions({ scales: { x: { ticks: { maxTicksLimit: 14 } }, y: { beginAtZero: true, min: 0 } } });

    watchEffect(() => {
      const data = toRef(props, 'reportData').value;
      if (!data || data.length === 0) return;

      hasPrData.value = data.some(d => d.pull_requests != null);
      if (!hasPrData.value) return;

      totalCreated.value = 0; totalReviewed.value = 0; totalMerged.value = 0; totalCreatedByCopilot.value = 0;
      data.forEach(d => {
        const pr = d.pull_requests;
        if (!pr) return;
        totalCreated.value += pr.total_created;
        totalReviewed.value += pr.total_reviewed;
        totalMerged.value += pr.total_merged;
        totalCreatedByCopilot.value += pr.total_created_by_copilot;
      });

      const labels = data.map(d => d.day);

      prActivityChartData.value = {
        labels,
        datasets: [
          { label: 'Created',  data: data.map(d => d.pull_requests?.total_created  || 0), borderColor: PALETTE[0].border, backgroundColor: PALETTE[0].bg, fill: true, tension: 0.3 },
          { label: 'Reviewed', data: data.map(d => d.pull_requests?.total_reviewed || 0), borderColor: PALETTE[1].border, backgroundColor: PALETTE[1].bg, fill: true, tension: 0.3 },
          { label: 'Merged',   data: data.map(d => d.pull_requests?.total_merged   || 0), borderColor: PALETTE[2].border, backgroundColor: PALETTE[2].bg, fill: true, tension: 0.3 },
        ],
      };

      copilotPrChartData.value = {
        labels,
        datasets: [
          { label: 'Created by Copilot',  data: data.map(d => d.pull_requests?.total_created_by_copilot  || 0), borderColor: PALETTE[3].border, backgroundColor: PALETTE[3].bg },
          { label: 'Reviewed by Copilot', data: data.map(d => d.pull_requests?.total_reviewed_by_copilot || 0), borderColor: PALETTE[4].border, backgroundColor: PALETTE[4].bg },
        ],
      };

      reviewSuggestionsChartData.value = {
        labels,
        datasets: [
          { label: 'Review Suggestions',  data: data.map(d => d.pull_requests?.total_suggestions         || 0), borderColor: PALETTE[5].border, backgroundColor: PALETTE[5].bg, fill: true, tension: 0.3 },
          { label: 'Applied Suggestions', data: data.map(d => d.pull_requests?.total_applied_suggestions || 0), borderColor: PALETTE[6].border, backgroundColor: PALETTE[6].bg, fill: true, tension: 0.3 },
          { label: 'Copilot Suggestions', data: data.map(d => d.pull_requests?.total_copilot_suggestions || 0), borderColor: PALETTE[2].border, backgroundColor: PALETTE[2].bg, fill: true, tension: 0.3 },
        ],
      };
    });

    return {
      totalCreated, totalReviewed, totalMerged, totalCreatedByCopilot, hasPrData,
      prActivityChartData, copilotPrChartData, reviewSuggestionsChartData,
      lineOpts, barOpts, plugins,
    };
  },
  data() {
    return { chartColumns: '2' };
  },
});
</script>

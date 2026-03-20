<template>
  <div>
    <div class="tiles-container">
      <!-- Agent LOC Added -->
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Agent Lines Added</div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">Total lines of code added by Copilot agents (agent mode and edit mode) across all IDEs.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">{{ dateRangeDescription }}</div>
            <p class="text-h4">{{ totalAgentLinesAdded.toLocaleString() }}</p>
          </div>
        </v-card-item>
      </v-card>

      <!-- Agent LOC Deleted -->
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Agent Lines Deleted</div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">Total lines of code deleted by Copilot agents across all IDEs.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">{{ dateRangeDescription }}</div>
            <p class="text-h4">{{ totalAgentLinesDeleted.toLocaleString() }}</p>
          </div>
        </v-card-item>
      </v-card>

      <!-- Agent Generation Activities -->
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Agent Code Generations</div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">Number of distinct code generation events by Copilot agents. Each event represents one code change applied by an agent.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">{{ dateRangeDescription }}</div>
            <p class="text-h4">{{ totalAgentGenerations.toLocaleString() }}</p>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">
      <v-container style="min-height: 300px;" class="px-4 elevation-2">
        <!-- Agent LOC Over Time -->
        <h2 class="mb-1">Agent Lines of Code Changed Over Time</h2>
        <Line :data="agentLocChartData" :options="chartOptions" />

        <!-- Feature Breakdown -->
        <h2 class="mb-1 mt-6">Feature Activity Breakdown</h2>
        <Bar :data="featureBreakdownChartData" :options="stackedBarOptions" />

        <!-- Model Usage -->
        <h2 class="mb-1 mt-6">Model Usage by Feature</h2>
        <v-data-table v-if="modelFeatureRows.length > 0" :headers="modelFeatureHeaders" :items="modelFeatureRows" class="elevation-2" />
        <v-alert v-else type="info" density="compact" text="No model-feature data available" />

      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watchEffect, type PropType } from 'vue';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import { Line, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS, ArcElement, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

export default defineComponent({
  name: 'AgentActivityViewer',
  components: { Line, Bar },
  props: {
    reportData: { type: Array as PropType<ReportDayTotals[]>, required: true },
    dateRangeDescription: { type: String, default: 'Over the last 28 days' }
  },
  setup(props) {
    const totalAgentLinesAdded = ref(0);
    const totalAgentLinesDeleted = ref(0);
    const totalAgentGenerations = ref(0);
    const agentLocChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const featureBreakdownChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] });
    const modelFeatureRows = ref<any[]>([]);

    const chartOptions = {
      responsive: true, maintainAspectRatio: true,
      layout: { padding: { left: 150, right: 150, top: 20, bottom: 40 } },
    };

    const stackedBarOptions = {
      responsive: true, maintainAspectRatio: true,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
      layout: { padding: { left: 100, right: 100, top: 20, bottom: 40 } },
    };

    const modelFeatureHeaders = [
      { title: 'Model', key: 'model' },
      { title: 'Feature', key: 'feature' },
      { title: 'Code Generations', key: 'generations' },
      { title: 'Lines Added', key: 'locAdded' },
      { title: 'Lines Deleted', key: 'locDeleted' },
      { title: 'Interactions', key: 'interactions' },
    ];

    const featureColors: Record<string, { bg: string; border: string }> = {
      'agent_edit': { bg: 'rgba(255, 99, 132, 0.5)', border: 'rgb(255, 99, 132)' },
      'code_completion': { bg: 'rgba(75, 192, 192, 0.5)', border: 'rgb(75, 192, 192)' },
      'chat_panel_agent_mode': { bg: 'rgba(153, 102, 255, 0.5)', border: 'rgb(153, 102, 255)' },
      'chat_panel_ask_mode': { bg: 'rgba(255, 159, 64, 0.5)', border: 'rgb(255, 159, 64)' },
      'chat_panel_edit_mode': { bg: 'rgba(54, 162, 235, 0.5)', border: 'rgb(54, 162, 235)' },
      'chat_panel_custom_mode': { bg: 'rgba(255, 205, 86, 0.5)', border: 'rgb(255, 205, 86)' },
      'chat_inline': { bg: 'rgba(201, 203, 207, 0.5)', border: 'rgb(201, 203, 207)' },
    };

    watchEffect(() => {
      const data = toRef(props, 'reportData').value;
      if (!data || data.length === 0) return;

      // Calculate totals from agent_edit feature
      totalAgentLinesAdded.value = 0;
      totalAgentLinesDeleted.value = 0;
      totalAgentGenerations.value = 0;

      data.forEach(day => {
        const agentFeature = (day.totals_by_feature || []).find(f => f.feature === 'agent_edit');
        if (agentFeature) {
          totalAgentLinesAdded.value += agentFeature.loc_added_sum;
          totalAgentLinesDeleted.value += agentFeature.loc_deleted_sum;
          totalAgentGenerations.value += agentFeature.code_generation_activity_count;
        }
      });

      // Agent LOC over time chart
      const labels = data.map(d => d.day);
      agentLocChartData.value = {
        labels,
        datasets: [
          {
            label: 'Agent Lines Added',
            data: data.map(d => {
              const f = (d.totals_by_feature || []).find(f => f.feature === 'agent_edit');
              return f?.loc_added_sum || 0;
            }),
            backgroundColor: 'rgba(255, 99, 132, 0.2)', borderColor: 'rgb(255, 99, 132)',
          },
          {
            label: 'Agent Lines Deleted',
            data: data.map(d => {
              const f = (d.totals_by_feature || []).find(f => f.feature === 'agent_edit');
              return f?.loc_deleted_sum || 0;
            }),
            backgroundColor: 'rgba(54, 162, 235, 0.2)', borderColor: 'rgb(54, 162, 235)',
          },
        ],
      };

      // Feature breakdown stacked bar chart — show generation activities per feature
      const allFeatures = [...new Set(data.flatMap(d => (d.totals_by_feature || []).map(f => f.feature)))];
      featureBreakdownChartData.value = {
        labels,
        datasets: allFeatures.map(feature => {
          const color = featureColors[feature] || { bg: 'rgba(100, 100, 100, 0.5)', border: 'rgb(100, 100, 100)' };
          return {
            label: feature.replace(/_/g, ' '),
            data: data.map(d => {
              const f = (d.totals_by_feature || []).find(f => f.feature === feature);
              return f?.code_generation_activity_count || 0;
            }),
            backgroundColor: color.bg, borderColor: color.border, borderWidth: 1,
          };
        }),
      };

      // Model-feature table: aggregate across all days
      const modelFeatureMap = new Map<string, { model: string; feature: string; generations: number; locAdded: number; locDeleted: number; interactions: number }>();
      data.forEach(day => {
        (day.totals_by_model_feature || []).forEach(mf => {
          const key = `${mf.model}|${mf.feature}`;
          const existing = modelFeatureMap.get(key);
          if (existing) {
            existing.generations += mf.code_generation_activity_count;
            existing.locAdded += mf.loc_added_sum;
            existing.locDeleted += mf.loc_deleted_sum;
            existing.interactions += mf.user_initiated_interaction_count;
          } else {
            modelFeatureMap.set(key, {
              model: mf.model, feature: mf.feature.replace(/_/g, ' '),
              generations: mf.code_generation_activity_count,
              locAdded: mf.loc_added_sum, locDeleted: mf.loc_deleted_sum,
              interactions: mf.user_initiated_interaction_count,
            });
          }
        });
      });
      modelFeatureRows.value = [...modelFeatureMap.values()].sort((a, b) => b.generations - a.generations);
    });

    return {
      totalAgentLinesAdded, totalAgentLinesDeleted, totalAgentGenerations,
      agentLocChartData, featureBreakdownChartData, modelFeatureRows,
      chartOptions, stackedBarOptions, modelFeatureHeaders,
    };
  },
});
</script>

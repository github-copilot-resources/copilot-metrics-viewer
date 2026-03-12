<template>
  <div>
    <div class="tiles-container">
      <!-- PRs Created -->
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 250px; height: 175px;">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <div class="text-h6 mb-1">PRs Created</div>
            <div class="text-caption">{{ dateRangeDescription }}</div>
            <p class="text-h4">{{ totalCreated }}</p>
          </div>
        </v-card-item>
      </v-card>

      <!-- PRs Reviewed -->
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 250px; height: 175px;">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <div class="text-h6 mb-1">PRs Reviewed</div>
            <div class="text-caption">{{ dateRangeDescription }}</div>
            <p class="text-h4">{{ totalReviewed }}</p>
          </div>
        </v-card-item>
      </v-card>

      <!-- PRs Merged -->
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 250px; height: 175px;">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <div class="text-h6 mb-1">PRs Merged</div>
            <div class="text-caption">{{ dateRangeDescription }}</div>
            <p class="text-h4">{{ totalMerged }}</p>
          </div>
        </v-card-item>
      </v-card>

      <!-- PRs by Copilot -->
      <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 250px; height: 175px;">
        <v-card-item>
          <div class="tiles-text">
            <div class="spacing-10"/>
            <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
              <template #activator="{ props }">
                <div v-bind="props" class="text-h6 mb-1">Created by Copilot</div>
              </template>
              <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                <span class="text-caption" style="font-size: 10px !important;">Pull requests created by Copilot coding agent.</span>
              </v-card>
            </v-tooltip>
            <div class="text-caption">{{ dateRangeDescription }}</div>
            <p class="text-h4">{{ totalCreatedByCopilot }}</p>
          </div>
        </v-card-item>
      </v-card>
    </div>

    <v-main class="p-1" style="min-height: 300px;">
      <v-container v-if="hasPrData" style="min-height: 300px;" class="px-4 elevation-2">
        <!-- PR Activity Over Time -->
        <h2 class="mb-1">Pull Request Activity Over Time</h2>
        <Line :data="prActivityChartData" :options="chartOptions" />

        <!-- Copilot PR Contributions -->
        <h2 class="mb-1 mt-6">Copilot PR Contributions</h2>
        <Bar :data="copilotPrChartData" :options="chartOptions" />

        <!-- Review Suggestions -->
        <h2 class="mb-1 mt-6">Review Suggestions</h2>
        <Line :data="reviewSuggestionsChartData" :options="chartOptions" />
      </v-container>
      <v-container v-else class="px-4">
        <v-alert type="info" density="compact" text="No pull request data available. PR metrics require organization-level API access." />
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, toRef, watchEffect, type PropType } from 'vue';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import { Line, Bar } from 'vue-chartjs';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Title, Tooltip, Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend);

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

    const chartOptions = {
      responsive: true, maintainAspectRatio: true,
      layout: { padding: { left: 150, right: 150, top: 20, bottom: 40 } },
    };

    watchEffect(() => {
      const data = toRef(props, 'reportData').value;
      if (!data || data.length === 0) return;

      // Check if any day has PR data
      hasPrData.value = data.some(d => d.pull_requests != null);
      if (!hasPrData.value) return;

      // Calculate totals
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

      // PR Activity chart
      prActivityChartData.value = {
        labels,
        datasets: [
          { label: 'Created', data: data.map(d => d.pull_requests?.total_created || 0), backgroundColor: 'rgba(75, 192, 192, 0.2)', borderColor: 'rgb(75, 192, 192)' },
          { label: 'Reviewed', data: data.map(d => d.pull_requests?.total_reviewed || 0), backgroundColor: 'rgba(153, 102, 255, 0.2)', borderColor: 'rgb(153, 102, 255)' },
          { label: 'Merged', data: data.map(d => d.pull_requests?.total_merged || 0), backgroundColor: 'rgba(255, 159, 64, 0.2)', borderColor: 'rgb(255, 159, 64)' },
        ],
      };

      // Copilot contribution chart
      copilotPrChartData.value = {
        labels,
        datasets: [
          { label: 'Created by Copilot', data: data.map(d => d.pull_requests?.total_created_by_copilot || 0), backgroundColor: 'rgba(255, 99, 132, 0.5)', borderColor: 'rgb(255, 99, 132)' },
          { label: 'Reviewed by Copilot', data: data.map(d => d.pull_requests?.total_reviewed_by_copilot || 0), backgroundColor: 'rgba(54, 162, 235, 0.5)', borderColor: 'rgb(54, 162, 235)' },
        ],
      };

      // Review suggestions chart
      reviewSuggestionsChartData.value = {
        labels,
        datasets: [
          { label: 'Review Suggestions', data: data.map(d => d.pull_requests?.total_suggestions || 0), backgroundColor: 'rgba(255, 205, 86, 0.2)', borderColor: 'rgb(255, 205, 86)' },
          { label: 'Applied Suggestions', data: data.map(d => d.pull_requests?.total_applied_suggestions || 0), backgroundColor: 'rgba(75, 192, 192, 0.2)', borderColor: 'rgb(75, 192, 192)' },
          { label: 'Copilot Suggestions', data: data.map(d => d.pull_requests?.total_copilot_suggestions || 0), backgroundColor: 'rgba(153, 102, 255, 0.2)', borderColor: 'rgb(153, 102, 255)' },
        ],
      };
    });

    return {
      totalCreated, totalReviewed, totalMerged, totalCreatedByCopilot, hasPrData,
      prActivityChartData, copilotPrChartData, reviewSuggestionsChartData, chartOptions,
    };
  },
});
</script>

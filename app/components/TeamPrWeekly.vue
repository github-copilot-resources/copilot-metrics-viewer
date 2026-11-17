<template>
  <v-card variant="outlined" data-testid="team-pr-weekly">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <span class="text-subtitle-1">Weekly merged pull requests{{ teamName ? ` — ${teamName}` : '' }}</span>
      <v-spacer />
      <v-btn
        v-if="!loaded"
        color="primary"
        size="small"
        variant="tonal"
        :loading="loading"
        @click="load"
      >
        Load PR data
      </v-btn>
      <v-btn v-else size="small" variant="text" :loading="loading" @click="load">Refresh</v-btn>
    </v-card-title>

    <v-card-text>
      <p v-if="!loaded && !loading && !error" class="text-body-2 text-medium-emphasis">
        Merged pull request counts come from the GitHub search API rather than the Copilot
        metrics API, which reports them only for whole organizations. They are fetched on
        demand to stay within search rate limits.
      </p>

      <v-alert v-if="error" :type="rateLimited ? 'warning' : 'error'" variant="tonal" density="compact" class="mb-3">
        {{ error }}
      </v-alert>

      <div v-if="loading" class="d-flex justify-center py-6">
        <v-progress-circular indeterminate color="primary" />
      </div>

      <template v-if="loaded && !loading">
        <v-row class="mb-2">
          <v-col v-for="kpi in kpis" :key="kpi.label" cols="6" md="3">
            <div class="text-caption text-medium-emphasis">{{ kpi.label }}</div>
            <div class="text-h6" :data-testid="kpi.label === 'Merged PRs' ? 'team-pr-merged-total' : undefined">{{ kpi.value }}</div>
          </v-col>
        </v-row>

        <v-alert v-if="warnings.length" type="info" variant="tonal" density="compact" class="mb-3">
          <div v-for="warning in warnings" :key="warning">{{ warning }}</div>
        </v-alert>

        <div v-if="chartData.labels?.length" style="position: relative; height: 240px; min-width: 0;">
          <Bar :data="chartData" :options="chartOptions" />
        </div>
        <p v-else class="text-medium-emphasis text-center py-4">No merged pull requests in this range.</p>
      </template>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, type PropType } from 'vue';
import { Bar } from 'vue-chartjs';
import type { ChartData } from 'chart.js';
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, BarElement, Title, Tooltip, Legend, Filler
} from 'chart.js';
import { PALETTE } from '@/utils/chartPlugins';
import type { TeamPrMetrics } from '../../server/services/team-pr-search';

ChartJS.register(CategoryScale, LinearScale, BarElement, PointElement, LineElement, Title, Tooltip, Legend, Filler);

export default defineComponent({
  name: 'TeamPrWeekly',
  components: { Bar },
  props: {
    /** Query params identifying the team and date range, as built by `Options`. */
    params: { type: Object as PropType<Record<string, unknown>>, required: true },
    teamName: { type: String, default: '' },
  },
  emits: {
    metrics: (_metrics: TeamPrMetrics | null) => true,
  },
  setup(props, { emit }) {
    const metrics = ref<TeamPrMetrics | null>(null);
    watch(metrics, value => emit('metrics', value), { immediate: true });
    const loading = ref(false);
    const error = ref('');
    const rateLimited = ref(false);
    const loaded = computed(() => metrics.value !== null);
    let requestVersion = 0;
    watch(() => JSON.stringify(props.params), () => {
      requestVersion++;
      metrics.value = null;
      error.value = '';
      rateLimited.value = false;
      loading.value = false;
    });

    const load = async () => {
      const version = ++requestVersion;
      loading.value = true;
      metrics.value = null;
      error.value = '';
      rateLimited.value = false;
      try {
        const result = await $fetch<TeamPrMetrics>('/api/team-pull-requests', { params: props.params });
        if (version === requestVersion) metrics.value = result;
      } catch (err: unknown) {
        if (version !== requestVersion) return;
        const failure = err as {
          statusCode?: number;
          statusMessage?: string;
          data?: { data?: { retryAfterMinutes?: number }; retryAfterMinutes?: number; message?: string; statusMessage?: string };
        };
        metrics.value = null;
        if (failure.statusCode === 429) {
          rateLimited.value = true;
          const minutes = failure.data?.data?.retryAfterMinutes ?? failure.data?.retryAfterMinutes ?? 1;
          error.value = `GitHub's search rate limit was reached. Come back in about ${minutes} minute${minutes === 1 ? '' : 's'} and try again.`;
        } else {
          error.value = failure.data?.message || failure.data?.statusMessage || failure.statusMessage
            || 'Could not load pull request data for this team.';
        }
      } finally {
        if (version === requestVersion) loading.value = false;
      }
    };

    const kpis = computed(() => {
      const data = metrics.value;
      if (!data) return [];
      const aiSharePct = data.totalMerged > 0 ? (data.totalAiTouched / data.totalMerged) * 100 : 0;
      return [
        { label: 'Merged PRs', value: `${data.truncated ? '≥ ' : ''}${data.totalMerged.toLocaleString()}` },
        { label: 'With AI contribution', value: `${data.totalAiTouched.toLocaleString()} (${aiSharePct.toFixed(0)}%)` },
        { label: 'Weekly average', value: data.rollingAverage.toFixed(1) },
        {
          label: 'Merged per person',
          value: data.avgMergedPerPerson === null ? '—' : data.avgMergedPerPerson.toFixed(1),
        },
      ];
    });

    const warnings = computed(() => {
      const data = metrics.value;
      if (!data) return [];
      const notes: string[] = [];
      if (data.truncated) {
        notes.push('This team is large enough that only some members could be queried; counts are a lower bound.');
      }
      if (!data.orgScoped) {
        notes.push('No organization could be determined, so results are not limited to this organization\'s repositories.');
      }
      if (data.weeks.some(week => week.partial)) {
        notes.push('Partial weeks are marked in chart tooltips and excluded from the weekly average when complete weeks are available.');
      }
      return notes;
    });

    // Mixed bar + line datasets are not expressible in ChartData<'bar'>, hence the cast.
    const chartData = computed<ChartData<'bar'>>(() => {
      const weeks = metrics.value?.weeks ?? [];
      const average = metrics.value?.rollingAverage ?? 0;
      return {
        labels: weeks.map(week => week.weekStart),
        datasets: [
          {
            label: 'Merged PRs',
            data: weeks.map(week => week.merged),
            backgroundColor: PALETTE[0]!.bg,
            borderColor: PALETTE[0]!.border,
            borderWidth: 1,
            order: 2,
          },
          {
            label: 'With AI contribution',
            data: weeks.map(week => week.aiTouched),
            backgroundColor: PALETTE[2]!.bg,
            borderColor: PALETTE[2]!.border,
            borderWidth: 1,
            order: 2,
          },
          {
            type: 'line' as const,
            label: 'Weekly average (complete weeks)',
            data: weeks.map(() => average),
            borderColor: PALETTE[4]!.border,
            borderDash: [6, 4],
            pointRadius: 0,
            fill: false,
            order: 1,
          },
        ],
      } as unknown as ChartData<'bar'>;
    });

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom' as const },
        tooltip: {
          callbacks: {
            afterTitle: (items: { dataIndex: number }[]) => {
              const week = metrics.value?.weeks[items[0]?.dataIndex ?? 0];
              return week?.partial ? 'Partial week (excluded from the average)' : '';
            },
          },
        },
      },
      scales: { y: { beginAtZero: true, title: { display: true, text: 'Pull requests' } } },
    };

    return { metrics, loading, loaded, error, rateLimited, load, kpis, warnings, chartData, chartOptions };
  },
});
</script>

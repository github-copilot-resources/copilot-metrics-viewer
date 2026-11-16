<template>
  <v-card variant="outlined" data-testid="team-leaderboard">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <span class="text-subtitle-1">Team leaderboard</span>
      <v-spacer />
      <v-select
        v-model="selectedMetric"
        :items="metricOptions"
        item-title="label"
        item-value="key"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 360px;"
      />
    </v-card-title>
    <v-card-text>
      <p v-if="isPrMetric" class="text-caption text-medium-emphasis mb-2">
        Load each team's PR data below to include it in the ranking.
        Counts marked ≥ are lower bounds from incomplete member searches.
      </p>
      <v-table density="compact">
        <thead>
          <tr>
            <th class="text-left">Rank</th>
            <th class="text-left">Team</th>
            <th class="text-right">{{ activeMetric.label }}</th>
            <th class="text-right">
              <v-tooltip location="top" open-delay="200">
                <template #activator="{ props: tip }">
                  <span v-bind="tip" style="cursor: help;">Trend</span>
                </template>
                <span>{{ isPrMetric ? 'Average merged PRs in the later half of complete weeks versus the earlier half. Partial weeks are excluded.' : 'Second half of the selected range compared with the first half.' }}</span>
              </v-tooltip>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rankedRows" :key="row.slug">
            <td>{{ row.rank }}</td>
            <td>
              <div class="d-flex align-center">
                <div class="team-swatch mr-2" :style="{ backgroundColor: row.color }" />
                {{ row.teamName }}
              </div>
            </td>
            <td class="text-right font-weight-medium">{{ row.display }}</td>
            <td class="text-right">
              <span :class="trendClass(row.trend.direction)">
                {{ trendArrow(row.trend.direction) }}
                <template v-if="row.trend.changePct !== null">
                  {{ Math.abs(row.trend.changePct).toFixed(0) }}%
                </template>
              </span>
            </td>
          </tr>
          <tr v-if="rankedRows.length === 0">
            <td colspan="4" class="text-center text-medium-emphasis">No team data for this range.</td>
          </tr>
        </tbody>
      </v-table>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, computed, ref, type PropType } from 'vue';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import type { TeamPrMetrics } from '../../server/services/team-pr-search';
import { summarizeTeam, trendWithinRange, type ReportingRange, type TeamMetricSummary, type Trend, type TrendDirection } from '@/utils/teamMetrics';

export interface LeaderboardTeam {
  slug: string;
  teamName: string;
  reportData: ReportDayTotals[];
  reportingRange?: ReportingRange;
  memberCount: number;
  color: string;
  prMetrics?: TeamPrMetrics | null;
}

type MetricKey =
  | 'agentLocSharePct' | 'copilotAdoptionPct' | 'agentAdoptionPct'
  | 'cliAdoptionPct' | 'activeUsersPct' | 'acceptanceRatePct'
  | 'prsMerged' | 'prsMergedPerPerson';

interface MetricOption {
  key: MetricKey;
  label: string;
  format: 'pct' | 'int' | 'decimal';
}

const METRIC_OPTIONS: MetricOption[] = [
  { key: 'agentLocSharePct', label: 'Agent share of Copilot-added LOC', format: 'pct' },
  { key: 'copilotAdoptionPct', label: 'Copilot adoption %', format: 'pct' },
  { key: 'agentAdoptionPct', label: 'Agent adoption %', format: 'pct' },
  { key: 'cliAdoptionPct', label: 'CLI adoption %', format: 'pct' },
  { key: 'activeUsersPct', label: 'Active users %', format: 'pct' },
  { key: 'acceptanceRatePct', label: 'Acceptance rate %', format: 'pct' },
  { key: 'prsMerged', label: 'PRs Merged', format: 'int' },
  { key: 'prsMergedPerPerson', label: 'PRs Merged per person', format: 'decimal' },
];

export default defineComponent({
  name: 'TeamLeaderboard',
  props: {
    teams: { type: Array as PropType<LeaderboardTeam[]>, required: true },
  },
  setup(props) {
    const selectedMetric = ref<MetricKey>('agentLocSharePct');
    const activeMetric = computed(
      () => METRIC_OPTIONS.find(option => option.key === selectedMetric.value) ?? METRIC_OPTIONS[0]!
    );

    const isPrMetric = computed(() => selectedMetric.value === 'prsMerged' || selectedMetric.value === 'prsMergedPerPerson');
    const pick = (summary: TeamMetricSummary) => {
      const key = activeMetric.value.key;
      return key === 'prsMerged' || key === 'prsMergedPerPerson' ? null : summary[key];
    };

    function prTrend(metrics: TeamPrMetrics | null | undefined): Trend {
      const weeks = (metrics?.weeks ?? []).filter(week => !week.partial).sort((a, b) => a.weekStart.localeCompare(b.weekStart));
      if (weeks.length < 2 || metrics?.truncated) return { direction: 'flat', changePct: null };
      const midpoint = Math.floor(weeks.length / 2);
      const earlier = weeks.slice(0, midpoint).reduce((sum, week) => sum + week.merged, 0) / midpoint;
      const later = weeks.slice(midpoint).reduce((sum, week) => sum + week.merged, 0) / (weeks.length - midpoint);
      return {
        direction: later > earlier ? 'up' : later < earlier ? 'down' : 'flat',
        changePct: earlier === 0 ? null : ((later - earlier) / earlier) * 100,
      };
    }

    const rankedRows = computed(() => {
      const rows = props.teams.map(team => {
        const value = isPrMetric.value
          ? selectedMetric.value === 'prsMerged' ? team.prMetrics?.totalMerged ?? null : team.prMetrics?.avgMergedPerPerson ?? null
          : pick(summarizeTeam(team.reportData, team.memberCount, team.reportingRange));
        return {
          slug: team.slug,
          teamName: team.teamName,
          color: team.color,
          value,
          display: isPrMetric.value && !team.prMetrics ? 'Not loaded' : `${isPrMetric.value && team.prMetrics?.truncated ? '≥ ' : ''}${formatValue(value, activeMetric.value.format)}`,
          trend: isPrMetric.value ? prTrend(team.prMetrics) : trendWithinRange(team.reportData, pick, team.memberCount),
        };
      });

      // Teams with an unknown value (no member count) sort last and are not ranked against.
      rows.sort((a, b) => (b.value ?? -Infinity) - (a.value ?? -Infinity));
      return rows.map((row, index) => ({ ...row, rank: row.value === null ? '—' : index + 1 }));
    });

    function formatValue(value: number | null, format: MetricOption['format']) {
      if (value === null) return '—';
      return format === 'pct' ? `${value.toFixed(1)}%` : format === 'decimal' ? value.toFixed(1) : Math.round(value).toLocaleString();
    }

    const trendArrow = (direction: TrendDirection) =>
      direction === 'up' ? '▲' : direction === 'down' ? '▼' : '–';
    const trendClass = (direction: TrendDirection) =>
      direction === 'up' ? 'trend-up' : direction === 'down' ? 'trend-down' : 'text-medium-emphasis';

    return {
      selectedMetric,
      metricOptions: METRIC_OPTIONS,
      activeMetric,
      isPrMetric,
      rankedRows,
      trendArrow,
      trendClass,
    };
  },
});
</script>

<style scoped>
.team-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  flex-shrink: 0;
}
.trend-up {
  color: rgb(var(--v-theme-success));
}
.trend-down {
  color: rgb(var(--v-theme-error));
}
</style>

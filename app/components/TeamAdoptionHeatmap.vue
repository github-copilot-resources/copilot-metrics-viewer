<template>
  <v-card variant="outlined">
    <v-card-title class="d-flex align-center flex-wrap ga-2">
      <span class="text-subtitle-1">Adoption heatmap</span>
      <v-spacer />
      <v-select
        v-model="selectedMetric"
        :items="metricOptions"
        item-title="label"
        item-value="key"
        density="compact"
        variant="outlined"
        hide-details
        style="max-width: 240px;"
      />
    </v-card-title>

    <v-card-text>
      <div v-if="weeks.length === 0" class="text-medium-emphasis text-center py-4">
        No weekly data for this range.
      </div>
      <template v-else>
        <div class="heatmap" :style="{ gridTemplateColumns: `minmax(120px, 1fr) repeat(${weeks.length}, minmax(48px, 1fr))` }">
          <div class="heatmap-head" />
          <div v-for="week in weeks" :key="week" class="heatmap-head text-caption">{{ shortDate(week) }}</div>

          <template v-for="row in rows" :key="row.slug">
            <div class="heatmap-label text-caption text-truncate">{{ row.teamName }}</div>
            <v-tooltip v-for="cell in row.cells" :key="row.slug + cell.weekStart" location="top" open-delay="150">
              <template #activator="{ props: tip }">
                <div v-bind="tip" class="heatmap-cell" :style="{ backgroundColor: cellColor(cell.adoptionPct) }">
                  {{ cell.adoptionPct === null ? '' : Math.round(cell.adoptionPct) }}
                </div>
              </template>
              <span>
                {{ row.teamName }} — week of {{ cell.weekStart }}:
                {{ cell.adoptionPct === null ? 'no member count available' : `${cell.adoptionPct.toFixed(1)}% adoption` }}
              </span>
            </v-tooltip>
          </template>
        </div>

        <v-alert v-if="summary" type="info" variant="tonal" density="compact" class="mt-4 text-body-2">
          {{ summary }}
        </v-alert>
      </template>
    </v-card-text>
  </v-card>
</template>

<script lang="ts">
import { defineComponent, computed, ref, type PropType } from 'vue';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import { weeklyAdoption, summarizeTeam } from '@/utils/teamMetrics';

export interface HeatmapTeam {
  slug: string;
  teamName: string;
  reportData: ReportDayTotals[];
  memberCount: number;
  since?: string;
  until?: string;
}

type MetricKey = 'copilot' | 'agent' | 'cli' | 'vscodeAgent';

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: 'copilot', label: 'Copilot adoption' },
  { key: 'agent', label: 'Agent adoption' },
  { key: 'cli', label: 'CLI adoption' },
  { key: 'vscodeAgent', label: 'VS Code agents' },
];

const SUMMARY_METRIC = {
  copilot: 'copilotAdoptionPct',
  agent: 'agentAdoptionPct',
  cli: 'cliAdoptionPct',
  vscodeAgent: 'vscodeAgentAdoptionPct',
} as const;

export default defineComponent({
  name: 'TeamAdoptionHeatmap',
  props: {
    teams: { type: Array as PropType<HeatmapTeam[]>, required: true },
  },
  setup(props) {
    const selectedMetric = ref<MetricKey>('copilot');

    const rows = computed(() =>
      props.teams.map(team => ({
        slug: team.slug,
        teamName: team.teamName,
        cells: weeklyAdoption(team.reportData, selectedMetric.value, team.memberCount),
      }))
    );

    // Teams can cover different weeks; the column set is their union so no
    // team's data silently disappears from the grid.
    const weeks = computed(() => {
      const all = new Set<string>();
      rows.value.forEach(row => row.cells.forEach(cell => all.add(cell.weekStart)));
      return [...all].sort();
    });

    const alignedRows = computed(() =>
      rows.value.map(row => ({
        ...row,
        cells: weeks.value.map(
          weekStart => row.cells.find(cell => cell.weekStart === weekStart) ?? { weekStart, adoptionPct: null }
        ),
      }))
    );

    const summary = computed(() => {
      const scored = props.teams
        .map(team => ({
          teamName: team.teamName,
          value: summarizeTeam(team.reportData, team.memberCount, team.since, team.until)[SUMMARY_METRIC[selectedMetric.value]],
        }))
        .filter((entry): entry is { teamName: string; value: number } => entry.value !== null);

      if (scored.length < 2) return '';
      scored.sort((a, b) => b.value - a.value);
      const top = scored[0]!;
      const bottom = scored.at(-1)!;
      const label = METRIC_OPTIONS.find(option => option.key === selectedMetric.value)!.label.toLowerCase();
      return `Highest ${label}: ${top.teamName} (${top.value.toFixed(1)}%). Lowest: ${bottom.teamName} (${bottom.value.toFixed(1)}%).`;
    });

    /** Null (unknown denominator) renders as a neutral grey, not as zero. */
    function cellColor(adoptionPct: number | null) {
      if (adoptionPct === null) return 'rgba(128,128,128,0.15)';
      const intensity = Math.min(adoptionPct, 100) / 100;
      return `rgba(46, 125, 50, ${0.12 + intensity * 0.78})`;
    }

    const shortDate = (day: string) => day.slice(5);

    return {
      selectedMetric,
      metricOptions: METRIC_OPTIONS,
      rows: alignedRows,
      weeks,
      summary,
      cellColor,
      shortDate,
    };
  },
});
</script>

<style scoped>
.heatmap {
  display: grid;
  gap: 2px;
  overflow-x: auto;
}
.heatmap-head {
  text-align: center;
  padding: 2px;
  white-space: nowrap;
}
.heatmap-label {
  display: flex;
  align-items: center;
  padding-right: 8px;
}
.heatmap-cell {
  min-height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.72rem;
  border-radius: 3px;
  color: #fff;
  cursor: help;
}
</style>

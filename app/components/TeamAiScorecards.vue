<template>
  <v-row>
    <v-col v-for="card in cards" :key="card.slug" cols="12" sm="6" md="4" lg="3">
      <v-card variant="outlined" class="pa-3 h-100">
        <div class="d-flex align-center mb-2">
          <div class="team-swatch mr-2" :style="{ backgroundColor: card.color }" />
          <span class="text-subtitle-2 font-weight-bold text-truncate">{{ card.teamName }}</span>
        </div>
        <div class="text-caption text-medium-emphasis mb-2">{{ card.memberCount }} members</div>

        <div v-for="stat in card.stats" :key="stat.label" class="d-flex justify-space-between align-center py-1">
          <v-tooltip location="top" open-delay="200">
            <template #activator="{ props: tip }">
              <span v-bind="tip" class="text-caption text-medium-emphasis" style="cursor: help;">
                {{ stat.label }}
              </span>
            </template>
            <span class="tooltip-text">{{ stat.tooltip }}</span>
          </v-tooltip>
          <span class="text-body-2 font-weight-medium">{{ stat.value }}</span>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>

<script lang="ts">
import { defineComponent, computed, type PropType } from 'vue';
import type { ReportDayTotals } from '../../server/services/github-copilot-usage-api';
import { summarizeTeam } from '@/utils/teamMetrics';

export interface ScorecardTeam {
  slug: string;
  teamName: string;
  reportData: ReportDayTotals[];
  memberCount: number;
  since?: string;
  until?: string;
  color: string;
}

export default defineComponent({
  name: 'TeamAiScorecards',
  props: {
    teams: { type: Array as PropType<ScorecardTeam[]>, required: true },
  },
  setup(props) {
    // Percentages and per-person figures are null when the team size is
    // unknown — show an em dash rather than a misleading 0%.
    const pct = (value: number | null) => (value === null ? '—' : `${value.toFixed(1)}%`);

    const cards = computed(() =>
      props.teams.map(team => {
        const summary = summarizeTeam(team.reportData, team.memberCount, team.since, team.until);
        return {
          slug: team.slug,
          teamName: team.teamName,
          color: team.color,
          memberCount: team.memberCount,
          stats: [
            {
              label: 'Agent share of Copilot-added LOC',
              value: pct(summary.agentLocSharePct),
              tooltip: 'Direct Agent/Edit-mode file additions (agent_edit) divided by all Copilot-added lines. Chat-panel copy/apply actions, including Agent chat, are not direct agent edits. Excludes deletions and manually written code.',
            },
            {
              label: 'Copilot adoption',
              value: pct(summary.copilotAdoptionPct),
              tooltip: 'Distinct Copilot users in the rolling window, as a share of current team members.',
            },
            {
              label: 'Agent adoption',
              value: pct(summary.agentAdoptionPct),
              tooltip: 'Distinct users of Copilot agents, as a share of current team members.',
            },
            {
              label: 'CLI adoption',
              value: pct(summary.cliAdoptionPct),
              tooltip: 'Distinct GitHub Copilot CLI users, as a share of current team members.',
            },
            {
              label: 'VS Code agent users',
              value: summary.vscodeAgentUsers.toLocaleString(),
              tooltip: 'Approximate: users who worked in VS Code and used an agent on the same day. The API reports editors and features separately, with no editor-by-feature breakdown.',
            },
          ],
        };
      })
    );

    return { cards };
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
.tooltip-text {
  font-size: 0.8rem;
}
</style>

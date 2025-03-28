<template>
  <div>
    <v-card>
      <v-toolbar color="indigo" elevation="4">
        <v-toolbar-title>{{ organization }} Teams Metrics</v-toolbar-title>
      </v-toolbar>
      <v-container>
        <!-- Teams Selection -->
        <v-row>
          <v-col cols="12">
            <v-select
              v-model="selectedTeams"
              :items="allTeams"
              label="Select Teams"
              multiple
              chips
              clearable
              persistent-hint
              hint="Select teams to filter metrics data"
              @change="handleTeamsChange"
            ></v-select>
          </v-col>
        </v-row>

        <!-- Teams Summary Table -->
        <v-row v-if="metricsReady">
          <v-col cols="12">
            <v-simple-table class="elevation-1 mb-6" fixed-header height="auto">
              <template v-slot:default>
                <thead>
                  <tr>
                    <th class="text-left primary--text" style="width: 15%;">Team</th>
                    <th class="text-center primary--text" style="width: 10%;">Total Suggestions</th>
                    <th class="text-center primary--text" style="width: 10%;">Total Acceptances</th>
                    <th class="text-center primary--text" style="width: 10%;">Lines Suggested</th>
                    <th class="text-center primary--text" style="width: 10%;">Lines Accepted</th>
                    <th class="text-center primary--text" style="width: 10%;">Chat Turns</th>
                    <th class="text-center primary--text" style="width: 10%;">Chat Acceptances</th>
                    <th class="text-center primary--text" style="width: 12.5%;">Acceptance Rate (Count)</th>
                    <th class="text-center primary--text" style="width: 12.5%;">Acceptance Rate (Lines)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="item in displayedTeamsSummary" :key="item.team">
                    <td class="text-left font-weight-medium">{{ item.team }}</td>
                    <td class="text-center">{{ item.total_suggestions_count.toLocaleString() }}</td>
                    <td class="text-center">{{ item.total_acceptances_count.toLocaleString() }}</td>
                    <td class="text-center">{{ item.total_lines_suggested.toLocaleString() }}</td>
                    <td class="text-center">{{ item.total_lines_accepted.toLocaleString() }}</td>
                    <td class="text-center">{{ item.total_chat_turns.toLocaleString() }}</td>
                    <td class="text-center">{{ item.total_chat_acceptances.toLocaleString() }}</td>
                    <td class="text-center">{{ (item.acceptance_rate_by_count * 100).toFixed(2) }}%</td>
                    <td class="text-center">{{ (item.acceptance_rate_by_lines * 100).toFixed(2) }}%</td>
                  </tr>
                  <tr v-if="displayedTeamsSummary.length === 0">
                    <td colspan="9" class="text-center py-4">No data available</td>
                  </tr>
                </tbody>
              </template>
            </v-simple-table>
          </v-col>
        </v-row>

        <!-- Loading State -->
        <v-row v-else>
          <v-col cols="12" class="text-center">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
          </v-col>
        </v-row>

        <!-- Metrics Viewer -->
        <v-row>
          <v-col cols="12">
            <div v-if="metricsReady" class="metrics-container">
              <div class="metrics-title">
                Detailed Metrics for {{ selectedTeams.length ? selectedTeams.join(', ') : 'All Teams' }}
              </div>
              <MetricsViewer 
                v-if="metrics.length"
                :metrics="metrics"
              />
              <v-alert
                v-else
                type="info"
                text
              >
                No metrics data available for the selected teams.
              </v-alert>
            </div>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue';
import type { Metrics } from '../model/Metrics';
import MetricsViewer from './MetricsViewer.vue';

const props = defineProps<{
  teams: string[],
  organization: string
}>();

const selectedTeams = ref<string[]>([]);
const metrics = ref<Metrics[]>([]);
const metricsReady = ref(false);
const teamMetrics = ref<{ team: string, metrics: Metrics[] }[]>([]);
const allTeams = ref<string[]>([]);
const loadingTeams = ref(false);
const error = ref<string | null>(null);

// Fetch all teams from the organization if no teams are provided
const fetchAllTeams = async () => {
  try {
    loadingTeams.value = true;
    error.value = null;
    const response = await $fetch('/api/teams');
    if (Array.isArray(response)) {
      allTeams.value = response.map((team: any) => team.name);
      console.log("All teams fetched:", allTeams.value);
      if (allTeams.value.length > 0) {
        await handleTeamsChange();
      }
    }
  } catch (err) {
    console.error('Error fetching teams:', err);
    error.value = 'Failed to fetch teams. Please try again later.';
  } finally {
    loadingTeams.value = false;
  }
};

onMounted(async () => {
  if (!props.teams || props.teams.length === 0) {
    await fetchAllTeams();
  } else {
    allTeams.value = props.teams;
    await handleTeamsChange();
  }
});

// Handle team selection changes
const handleTeamsChange = async () => {
  try {
    metricsReady.value = false;
    error.value = null;
    const teamsToFetch = selectedTeams.value.length > 0 ? selectedTeams.value : allTeams.value;
    
    if (!teamsToFetch || teamsToFetch.length === 0) {
      error.value = 'No teams available to fetch metrics';
      return;
    }

    console.log('Fetching metrics for teams:', teamsToFetch);
    const response = await $fetch('/api/teams-metrics', {
      method: 'POST',
      body: {
        teams: teamsToFetch
      }
    });

    if (response?.teamMetrics?.length > 0) {
      teamMetrics.value = response.teamMetrics;
      
      if (selectedTeams.value.length > 0) {
        const selectedMetrics = response.teamMetrics
          .filter(tm => selectedTeams.value.includes(tm.team))
          .flatMap(tm => tm.metrics);
        metrics.value = selectedMetrics;
      } else {
        metrics.value = response.metrics;
      }
    } else {
      metrics.value = [];
      teamMetrics.value = [];
      error.value = 'No metrics data available for the selected teams';
    }
  } catch (err) {
    console.error('Error fetching team metrics:', err);
    metrics.value = [];
    teamMetrics.value = [];
    error.value = 'Failed to fetch team metrics. Please try again later.';
  } finally {
    metricsReady.value = true;
  }
};

// Watch for teams prop changes
watch(() => props.teams, (newTeams) => {
  if (newTeams.length > 0) {
    selectedTeams.value = []; // Reset selection when teams list changes
    handleTeamsChange();
  }
}, { immediate: true });

// Calculate team summaries
const displayedTeamsSummary = computed(() => {
  if (!teamMetrics.value.length) return [];
  
  const teamsToDisplay = selectedTeams.value.length > 0
    ? teamMetrics.value.filter(tm => selectedTeams.value.includes(tm.team))
    : teamMetrics.value;
  
  return teamsToDisplay.map(tm => {
    const summary = tm.metrics.reduce((acc, metric) => {
      acc.total_suggestions_count += metric.total_suggestions_count;
      acc.total_acceptances_count += metric.total_acceptances_count;
      acc.total_lines_suggested += metric.total_lines_suggested;
      acc.total_lines_accepted += metric.total_lines_accepted;
      acc.total_chat_acceptances += metric.total_chat_acceptances;
      acc.total_chat_turns += metric.total_chat_turns;
      return acc;
    }, {
      team: tm.team,
      total_suggestions_count: 0,
      total_acceptances_count: 0,
      total_lines_suggested: 0,
      total_lines_accepted: 0,
      total_chat_acceptances: 0,
      total_chat_turns: 0,
      acceptance_rate_by_count: 0,
      acceptance_rate_by_lines: 0
    });
    
    summary.acceptance_rate_by_count = summary.total_suggestions_count > 0 
      ? summary.total_acceptances_count / summary.total_suggestions_count 
      : 0;
    summary.acceptance_rate_by_lines = summary.total_lines_suggested > 0 
      ? summary.total_lines_accepted / summary.total_lines_suggested 
      : 0;
    
    return summary;
  });
});
</script>

<style scoped>
.v-toolbar-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.v-simple-table {
  margin: 0 16px 20px 16px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  width: calc(100% - 32px);
}

/* Table header styles */
:deep(.v-simple-table > .v-table__wrapper > table > thead > tr > th) {
  background: linear-gradient(to bottom, #f5f7ff, #e8eaf6);
  color: #1a237e;
  font-weight: 600;
  padding: 12px 16px;
  font-size: 0.875rem;
  border-bottom: 2px solid #1a237e;
  white-space: nowrap;
}

/* Table body styles */
:deep(.v-simple-table > .v-table__wrapper > table > tbody > tr > td) {
  padding: 12px 16px;
  font-size: 0.875rem;
  border-bottom: 1px solid #e8eaf6;
}

/* Zebra striping */
:deep(.v-simple-table > .v-table__wrapper > table > tbody > tr:nth-child(even)) {
  background-color: #fafafa;
}

/* Hover effect */
:deep(.v-simple-table > .v-table__wrapper > table > tbody > tr:hover) {
  background-color: rgba(26, 35, 126, 0.04);
}

/* Metrics container styles */
.metrics-container {
  padding: 16px;
  background: #fff;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12);
}

.metrics-title {
  font-size: 1.1rem;
  font-weight: 500;
  color: #1a237e;
  margin-bottom: 16px;
  padding-left: 8px;
  border-left: 4px solid #1a237e;
}

/* Select field styles */
:deep(.v-select) {
  margin-bottom: 16px;
}

:deep(.v-select__slot) {
  border-color: #1a237e;
}

:deep(.v-select__selection) {
  color: #1a237e;
}
</style>

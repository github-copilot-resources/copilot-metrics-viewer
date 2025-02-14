<template>
  <div>
    <v-card>
      <v-toolbar color="indigo" elevation="4">
        <v-toolbar-title>Multi-Teams Metrics Viewer</v-toolbar-title>
      </v-toolbar>
      <v-container>
        <!-- Teams Selection -->
        <v-row>
          <v-col cols="12">
            <v-select
              v-model="selectedTeams"
              :items="teams"
              label="Select Teams from All"
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
        <v-simple-table class="elevation-1 mb-6" fixed-header height="auto">
          <template v-slot:default>
            <thead>
              <tr>
                <th class="text-left primary--text" style="width: 15%;">Team</th>
                <th class="text-center primary--text" style="width: 10%;">Total Suggestions</th>
                <th class="text-center primary--text" style="width: 10%;">Total Acceptances</th>
                <th class="text-center primary--text" style="width: 10%;">Lines Suggested</th>
                <th class="text-center primary--text" style="width: 10%;">Lines Accepted</th>
                <th class="text-center primary--text" style="width: 10%;">Chat Acceptances</th>
                <th class="text-center primary--text" style="width: 10%;">Chat Turns</th>
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
                <td class="text-center">{{ item.total_chat_acceptances.toLocaleString() }}</td>
                <td class="text-center">{{ item.total_chat_turns.toLocaleString() }}</td>
                <td class="text-center">{{ (item.acceptance_rate_by_count * 100).toFixed(2) }}%</td>
                <td class="text-center">{{ (item.acceptance_rate_by_lines * 100).toFixed(2) }}%</td>
              </tr>
              <tr v-if="displayedTeamsSummary.length === 0">
                <td colspan="9" class="text-center py-4">No data available</td>
              </tr>
            </tbody>
          </template>
        </v-simple-table>

        <!-- Metrics Viewer -->
        <v-row>
          <v-col cols="12">
            <div v-if="metricsReady" class="metrics-container">
              <div class="metrics-title">Detailed Metrics for {{ selectedTeamsLabel }}</div>
              <div class="mb-4">
                <v-chip
                  v-if="metrics && metrics.length > 0"
                  color="primary"
                  small
                >
                Days+Teams combination of data: {{ metrics.length }} 
                </v-chip>
              </div>
              <MetricsViewer 
                v-if="metrics && metrics.length > 0"
                :key="`metrics-${selectedTeams.length ? selectedTeams.join('-') : 'all'}`"
                :metrics="metrics"
              />
              <v-alert
                v-else
                type="info"
                text
                class="mt-4"
              >
                No metrics data available for {{ selectedTeams.length ? 'selected teams' : 'any team' }}.
                {{ selectedTeams.length ? 'Try selecting different teams.' : 'Please select some teams to view their metrics.' }}
              </v-alert>
            </div>
            <v-progress-linear v-else indeterminate color="indigo"></v-progress-linear>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch, computed, onMounted } from 'vue';
import { getMultipleTeamsMetricsApi } from '../api/GitHubApi';
import { Metrics } from '../model/Metrics';
import MetricsViewer from './MetricsViewer.vue';

interface TeamSummary {
  team: string;
  total_suggestions_count: number;
  total_acceptances_count: number;
  total_lines_suggested: number;
  total_lines_accepted: number;
  total_chat_acceptances: number;
  total_chat_turns: number;
  acceptance_rate_by_count: number;
  acceptance_rate_by_lines: number;
}

export default defineComponent({
  name: 'MultiTeamsMetricsViewer',
  components: {
    MetricsViewer
  },
  props: {
    teams: {
      type: Array as () => string[],
      required: true
    }
  },
  setup(props) {
    const selectedTeams = ref<string[]>([]);
    const metrics = ref<Metrics[]>([]);
    const metricsReady = ref(false);
    const teamMetrics = ref<{ team: string, metrics: Metrics[] }[]>([]);

    // Handle team selection changes
    const handleTeamsChange = async () => {
      try {
        metricsReady.value = false;
        // Always fetch metrics for selected teams or all teams if none selected
        const teamsToFetch = selectedTeams.value.length > 0 ? selectedTeams.value : props.teams;
        
        const data = await getMultipleTeamsMetricsApi(teamsToFetch);
        if (data && data.teamMetrics.length > 0) {
          // Store all fetched team metrics
          teamMetrics.value = data.teamMetrics;
          
          // Update displayed metrics based on selection
          if (selectedTeams.value.length > 0) {
            const selectedMetrics = data.teamMetrics
              .filter(tm => selectedTeams.value.includes(tm.team))
              .flatMap(tm => tm.metrics);
            metrics.value = selectedMetrics;
          } else {
            metrics.value = data.metrics;
          }
        } else {
          metrics.value = [];
          teamMetrics.value = [];
        }
      } catch (error) {
        console.error('Error fetching team metrics:', error);
        metrics.value = [];
        teamMetrics.value = [];
      } finally {
        metricsReady.value = true;
      }
    };

    // Initial fetch when component mounts
    onMounted(() => {
      if (props.teams.length > 0) {
        handleTeamsChange();
      }
    });

    // Watch for teams prop changes
    watch(() => props.teams, (newTeams) => {
      if (newTeams.length > 0) {
        selectedTeams.value = []; // Reset selection when teams list changes
        handleTeamsChange();
      }
    });

    // Watch for team selection changes
    watch(selectedTeams, () => {
      handleTeamsChange();
    });

    // Calculate team summaries for display
    const calculateTeamSummaries = (teamsData: { team: string, metrics: Metrics[] }[]): TeamSummary[] => {
      return teamsData.map(tm => {
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
        } as TeamSummary);
        
        // Calculate rates only if we have data
        summary.acceptance_rate_by_count = summary.total_suggestions_count > 0 
          ? summary.total_acceptances_count / summary.total_suggestions_count 
          : 0;
        summary.acceptance_rate_by_lines = summary.total_lines_suggested > 0 
          ? summary.total_lines_accepted / summary.total_lines_suggested 
          : 0;
        
        return summary;
      });
    };

    // Computed property for displayed team summaries
    const displayedTeamsSummary = computed(() => {
      if (!teamMetrics.value.length) return [];
      
      const teamsToDisplay = selectedTeams.value.length > 0
        ? teamMetrics.value.filter(tm => selectedTeams.value.includes(tm.team))
        : teamMetrics.value;
      
      return calculateTeamSummaries(teamsToDisplay);
    });

    const selectedTeamsLabel = computed(() => 
      selectedTeams.value.length === 0 ? 'All Teams' : selectedTeams.value.join(', ')
    );

    return { 
      selectedTeams, 
      metrics, 
      metricsReady, 
      displayedTeamsSummary,
      handleTeamsChange,
      selectedTeamsLabel
    };
  }
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

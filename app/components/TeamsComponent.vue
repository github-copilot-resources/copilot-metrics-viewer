<template>
  <div style="position: relative;">
    <!-- Loading overlay while fetching team metrics -->
    <v-overlay
      :model-value="isLoading"
      contained
      persistent
      class="align-center justify-center"
    >
      <v-progress-circular indeterminate color="primary" size="48" />
    </v-overlay>

    <!-- Description card (matches org style) -->
    <v-card variant="outlined" class="mx-4 mt-3 mb-1 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">🏢 Teams Dashboard</div>
          <div class="text-medium-emphasis">
            Compare Copilot usage across teams. Select <strong>one team</strong> for a full deep-dive view with charts and per-user metrics, or <strong>multiple teams</strong> to compare them side by side.
          </div>
        </div>
      </div>
    </v-card>

    <!-- Rate limit warning when not using historical/DB mode -->
    <v-alert
      v-if="!isHistoricalMode"
      type="warning"
      variant="tonal"
      density="compact"
      class="mx-4 mb-1"
      closable
    >
      <strong>Performance notice:</strong> Team metrics are computed by fetching enterprise-wide user data and filtering by team membership.
      Each team selection triggers a full user-metrics download, which may hit GitHub API rate limits with frequent use.
      For production use, enable <strong>historical mode</strong> (<code>ENABLE_HISTORICAL_MODE=true</code>) to cache data in the database and avoid repeated API calls.
    </v-alert>

    <!-- Team selector -->
    <v-card variant="outlined" class="mx-4 mb-2 pa-3" density="compact">
      <!-- Organization dropdown (enterprise scope) -->
      <div v-if="scopeType === 'enterprise'" class="mb-2">
        <v-autocomplete
          v-model="selectedOrg"
          :items="availableOrgs"
          item-value="login"
          item-title="name"
          label="Filter by organization (optional)"
          clearable
          variant="outlined"
          density="compact"
          :theme="isDark ? 'dark' : 'light'"
          :menu-props="{
            contentClass: 'orgs-select-menu',
            maxHeight: 360,
            scrim: false,
            offset: 8
          }"
          :hint="isFullGhec ? 'Select an org to browse its teams, or leave blank for enterprise-level teams' : 'No organizations found for this enterprise'"
          persistent-hint
          :disabled="!isFullGhec"
          prepend-inner-icon="mdi-domain"
        >
          <template #item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.login" />
          </template>
          <template v-if="selectedOrg" #append-inner>
            <v-tooltip text="Switch to org view" location="top">
              <template #activator="{ props: tooltipProps }">
                <v-btn
                  v-bind="tooltipProps"
                  :to="`/orgs/${selectedOrg}`"
                  icon="mdi-open-in-new"
                  variant="text"
                  size="small"
                  density="compact"
                />
              </template>
            </v-tooltip>
          </template>
        </v-autocomplete>
      </div>
      <div class="d-flex align-start gap-2">
        <v-autocomplete
          v-model="selectedTeams"
          :items="availableTeams"
          item-value="slug"
          item-title="name"
          label="Search and select teams"
          multiple
          chips
          clearable
          variant="outlined"
          density="compact"
          :theme="isDark ? 'dark' : 'light'"
          :menu-props="{
            contentClass: 'teams-select-menu',
            maxHeight: 360,
            scrim: false,
            closeOnContentClick: false,
            offset: 8
          }"
          :hint="`Type to filter · 1 team = deep dive · 2+ teams = comparison`"
          persistent-hint
          class="flex-grow-1"
        >
          <template #item="{ props, item }">
            <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.description" />
          </template>
          <template #chip="{ props, item }">
            <v-chip v-bind="props" class="select-chip" :text="item.raw.name" closable />
          </template>
        </v-autocomplete>
        <div class="d-flex align-center gap-4 flex-shrink-0 mt-1 ml-2">
          <v-chip v-if="singleTeamMode" color="primary" size="small" prepend-icon="mdi-view-dashboard">Deep Dive</v-chip>
          <v-chip v-else-if="comparisonMode" color="secondary" size="small" prepend-icon="mdi-compare">Comparison</v-chip>
          <v-btn v-if="selectedTeams.length > 0" variant="outlined" size="small" @click="clearSelection">Clear All</v-btn>
        </div>
      </div>
    </v-card>

    <!-- ═══════════════════════════════════════════════ SINGLE TEAM DEEP DIVE -->
    <div v-if="singleTeamMode">
      <!-- Team header — same compact card as comparison mode -->
      <v-container fluid class="px-4 pb-0">
        <v-row dense>
          <v-col v-for="card in comparisonSummaryCards" :key="card.teamName" cols="12" sm="6" md="4" lg="3">
            <v-card elevation="3" class="pa-3" :style="`border-left: 4px solid ${card.color.border}`">
              <div class="d-flex align-center gap-2 mb-1">
                <v-icon size="18" :color="card.color.border">mdi-account-group</v-icon>
                <span class="text-subtitle-2 font-weight-medium">{{ card.teamName }}</span>
                <v-spacer />
                <v-btn
                  variant="text"
                  size="x-small"
                  icon
                  title="Deselect team"
                  @click="selectedTeams = []"
                >
                  <v-icon size="14">mdi-close</v-icon>
                </v-btn>
              </div>
              <div class="d-flex justify-space-between text-caption text-medium-emphasis">
                <span>Active Users</span>
                <span class="font-weight-medium">{{ card.activeUsers }}</span>
              </div>
              <div class="d-flex justify-space-between text-caption text-medium-emphasis">
                <span>Acceptance Rate</span>
                <span class="font-weight-medium">{{ card.acceptanceRate }}%</span>
              </div>
              <div class="d-flex justify-space-between text-caption text-medium-emphasis">
                <span>Interactions</span>
                <span class="font-weight-medium">{{ card.totalInteractions.toLocaleString() }}</span>
              </div>
              <div class="text-caption text-medium-emphasis mt-1">{{ dateRangeDesc }}</div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- KPI Tiles -->
      <div class="tiles-container">
        <v-card v-for="tile in singleTeamKPIs" :key="tile.label" elevation="4" color="surface" variant="elevated" class="my-2">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                <template #activator="{ props: tip }">
                  <div v-bind="tip" class="text-h6 mb-1">{{ tile.label }}</div>
                </template>
                <v-card class="pa-3 metric-tooltip"><span class="tooltip-text">{{ tile.tooltip }}</span></v-card>
              </v-tooltip>
              <div class="text-caption text-medium-emphasis">{{ tile.subtitle }}</div>
              <p :class="`kpi-value mt-1 text-${tile.color}`">{{ tile.value }}</p>
            </div>
          </v-card-item>
        </v-card>
      </div>

      <!-- Column toggle + Charts -->
      <v-container :fluid="chartColumns === 'full'" :class="['elevation-2 mt-1 mb-2', chartColumns === 'full' ? 'px-0' : 'px-4']">
        <div class="d-flex justify-end mb-3">
          <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
            <v-btn value="1" size="small"><v-icon size="18">mdi-view-stream</v-icon></v-btn>
            <v-btn value="2" size="small"><v-icon size="18">mdi-view-grid</v-icon></v-btn>
          </v-btn-toggle>
        </div>

        <!-- Row 1: Acceptance Rate | Active Users time series -->
        <v-row>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Acceptance Rate (%)</v-card-title>
              <div style="height:220px">
                <LineChart :data="singleTeamAcceptanceRateData" :options="compactLineOptions" />
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Active Users</v-card-title>
              <div style="height:220px">
                <LineChart :data="singleTeamActiveUsersData" :options="compactLineOptions" />
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Row 2: Language Distribution | Editor Usage -->
        <v-row class="mt-2">
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Language Distribution</v-card-title>
              <div v-if="singleTeamLangDonutData.labels.length" style="height:260px">
                <Doughnut :data="singleTeamLangDonutData" :options="donutOptions" />
              </div>
              <div v-else class="text-center text-medium-emphasis py-8">
                <v-icon size="40" color="grey-lighten-1">mdi-code-braces</v-icon>
                <p class="mt-2 text-body-2">No language data available</p>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Editor Usage</v-card-title>
              <div v-if="singleTeamEditorBarData.labels.length" style="height:260px">
                <BarChart :data="singleTeamEditorBarData" :options="horizontalBarOptions" />
              </div>
              <div v-else class="text-center text-medium-emphasis py-8">
                <v-icon size="40" color="grey-lighten-1">mdi-code-tags</v-icon>
                <p class="mt-2 text-body-2">No editor data available</p>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Row 2.5: Feature Usage Over Time (full-width) -->
        <v-row v-if="singleTeamFeatureUsageData.datasets.length" class="mt-2">
          <v-col cols="12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Feature Usage Over Time</v-card-title>
              <div style="height:220px">
                <LineChart :data="singleTeamFeatureUsageData" :options="compactLineOptions" />
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Row 3: Top Models | Language Acceptance Rate table -->
        <v-row class="mt-2">
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3 mb-2">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Top Models by Interactions</v-card-title>
              <div v-if="singleTeamModelsData.labels.length" style="height:260px">
                <BarChart :data="singleTeamModelsData" :options="horizontalBarOptions" />
              </div>
              <div v-else class="text-center text-medium-emphasis py-6">
                <v-icon size="40" color="grey-lighten-1">mdi-robot</v-icon>
                <p class="mt-2 text-body-2">No model data available (requires new Copilot API)</p>
              </div>
            </v-card>
            <v-card v-if="singleTeamModelUsageOverTimeData.datasets.length" class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Model Usage Over Time</v-card-title>
              <div style="height:220px">
                <LineChart :data="singleTeamModelUsageOverTimeData" :options="compactLineOptions" />
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Language Acceptance Rates</v-card-title>
              <v-table v-if="topLanguages.length" density="compact" class="lang-rate-table">
                <thead>
                  <tr>
                    <th>Language</th>
                    <th class="text-right">Generated</th>
                    <th class="text-right">Acceptance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="row in topLanguages" :key="row.language">
                    <td>{{ row.language }}</td>
                    <td class="text-right">{{ row.suggestions.toLocaleString() }}</td>
                    <td class="text-right">{{ row.rate.toFixed(1) }}%</td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else class="text-center text-medium-emphasis py-8">
                <p class="text-body-2">No language data available</p>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- User Metrics Table -->
        <v-row class="mt-2">
          <v-col cols="12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-1">User Activity</v-card-title>
              <v-card-subtitle v-if="!userMetricsError" class="pb-2 text-caption">Based on latest sync period · sorted by interactions</v-card-subtitle>
              <v-card-subtitle v-else class="pb-2 text-warning text-caption">
                <v-icon size="16" color="warning" class="mr-1">mdi-alert-circle-outline</v-icon>
                {{ userMetricsError }}
              </v-card-subtitle>
              <v-progress-linear v-if="userMetricsLoading" indeterminate color="primary" class="mb-2" />
              <v-table v-if="sortedUserMetrics.length" density="compact">
                <thead>
                  <tr>
                    <th>User</th>
                    <th class="text-right">Active Days</th>
                    <th class="text-right">Interactions</th>
                    <th class="text-right">Code Generated</th>
                    <th class="text-right">Acceptance Rate</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="user in sortedUserMetrics" :key="user.login">
                    <td>
                      <span class="font-weight-medium">{{ user.login }}</span>
                    </td>
                    <td class="text-right">{{ user.total_active_days }}</td>
                    <td class="text-right">{{ user.user_initiated_interaction_count.toLocaleString() }}</td>
                    <td class="text-right">{{ user.code_generation_activity_count.toLocaleString() }}</td>
                    <td class="text-right">
                      {{ user.code_generation_activity_count
                        ? ((user.code_acceptance_activity_count / user.code_generation_activity_count) * 100).toFixed(1) + '%'
                        : '—' }}
                    </td>
                  </tr>
                </tbody>
              </v-table>
              <div v-else-if="!userMetricsLoading && !userMetricsError" class="text-center text-medium-emphasis py-6">
                <v-icon size="40" color="grey-lighten-1">mdi-account-outline</v-icon>
                <p class="mt-2 text-body-2">No user data available</p>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </div>

    <!-- ═══════════════════════════════════════════════ COMPARISON MODE (2+ teams) -->
    <div v-else-if="comparisonMode">
      <!-- Per-team summary cards -->
      <v-container fluid class="px-4 pb-0">
        <v-row dense>
          <v-col v-for="card in comparisonSummaryCards" :key="card.teamName" cols="12" sm="6" md="4" lg="3">
            <v-card elevation="3" class="pa-3" :style="`border-left: 4px solid ${card.color.border}`">
              <div class="d-flex align-center gap-2 mb-1">
                <v-icon size="18" :color="card.color.border">mdi-account-group</v-icon>
                <span class="text-subtitle-2 font-weight-medium">{{ card.teamName }}</span>
                <v-spacer />
                <v-btn
                  variant="text"
                  size="x-small"
                  icon
                  :title="`Remove ${card.teamName}`"
                  @click="selectedTeams = selectedTeams.filter(s => s !== card.slug)"
                >
                  <v-icon size="14">mdi-close</v-icon>
                </v-btn>
              </div>
              <div class="d-flex justify-space-between text-caption text-medium-emphasis">
                <span>Active Users</span>
                <span class="font-weight-medium">{{ card.activeUsers }}</span>
              </div>
              <div class="d-flex justify-space-between text-caption text-medium-emphasis">
                <span>Acceptance Rate</span>
                <span class="font-weight-medium">{{ card.acceptanceRate }}%</span>
              </div>
              <div class="d-flex justify-space-between text-caption text-medium-emphasis">
                <span>Interactions</span>
                <span class="font-weight-medium">{{ card.totalInteractions.toLocaleString() }}</span>
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>

      <!-- Column toggle + comparison charts -->
      <v-container :fluid="chartColumns === 'full'" :class="['elevation-2 mt-1 mb-2', chartColumns === 'full' ? 'px-0' : 'px-4']">
        <div class="d-flex justify-end mb-3">
          <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
            <v-btn value="1" size="small"><v-icon size="18">mdi-view-stream</v-icon></v-btn>
            <v-btn value="2" size="small"><v-icon size="18">mdi-view-grid</v-icon></v-btn>
          </v-btn-toggle>
        </div>

        <!-- Row 1: Acceptance Rate | Active Users (line charts, overlapping) -->
        <v-row>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Acceptance Rate (%) — by Team</v-card-title>
              <div style="height:240px">
                <LineChart :data="acceptanceRateCountChartData" :options="compactLineOptions" />
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Active Users — by Team</v-card-title>
              <div style="height:240px">
                <LineChart :data="activeUsersChartData" :options="compactLineOptions" />
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Row 2: Language comparison | Editor comparison -->
        <v-row class="mt-2">
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Language Usage — by Team</v-card-title>
              <v-card-subtitle class="pb-1 text-caption">Code acceptance rate per language</v-card-subtitle>
              <div v-if="languageBarChartData.datasets.length" style="height:280px">
                <BarChart :data="languageBarChartData" :options="groupedBarOptions" />
              </div>
              <div v-else class="text-center text-medium-emphasis py-8">
                <v-icon size="40" color="grey-lighten-1">mdi-chart-bar</v-icon>
                <p class="mt-2 text-body-2">No language data available</p>
              </div>
            </v-card>
          </v-col>
          <v-col cols="12" :md="chartColumns === '2' ? 6 : 12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Editor Usage — by Team</v-card-title>
              <v-card-subtitle class="pb-1 text-caption">Total active users per editor</v-card-subtitle>
              <div v-if="editorBarChartData.datasets.length" style="height:280px">
                <BarChart :data="editorBarChartData" :options="groupedBarOptions" />
              </div>
              <div v-else class="text-center text-medium-emphasis py-8">
                <v-icon size="40" color="grey-lighten-1">mdi-chart-bar</v-icon>
                <p class="mt-2 text-body-2">No editor data available</p>
              </div>
            </v-card>
          </v-col>
        </v-row>

        <!-- Row 3: Models comparison -->
        <v-row class="mt-2" v-if="comparisonModelsData.datasets.length">
          <v-col cols="12">
            <v-card class="pa-3">
              <v-card-title class="text-subtitle-1 font-weight-medium pt-1 pb-2">Model Usage — by Team</v-card-title>
              <v-card-subtitle class="pb-1 text-caption">Total interactions per model</v-card-subtitle>
              <div style="height:260px">
                <BarChart :data="comparisonModelsData" :options="groupedBarOptions" />
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </div>

    <!-- ═══════════════════════════════════════════════ EMPTY STATE -->
    <v-container v-else>
      <v-card class="text-center pa-8">
        <v-card-text>
          <v-icon size="64" color="grey-lighten-1">mdi-account-group-outline</v-icon>
          <h3 class="text-h5 mt-4 mb-2">No Team Selected</h3>
          <p class="text-body-1 text-medium-emphasis mb-4">
            Select <strong>one team</strong> for a full dashboard view, or <strong>multiple teams</strong> to compare their metrics side by side.
          </p>
          <div class="d-flex justify-center gap-4 flex-wrap">
            <div class="text-center">
              <v-icon color="primary" size="32">mdi-view-dashboard</v-icon>
              <p class="text-caption mt-1">1 team → Deep Dive<br><span class="text-medium-emphasis">Charts, languages, editors, models, users</span></p>
            </div>
            <div class="text-center">
              <v-icon color="secondary" size="32">mdi-compare</v-icon>
              <p class="text-caption mt-1">2+ teams → Comparison<br><span class="text-medium-emphasis">Side-by-side metrics comparison</span></p>
            </div>
          </div>
        </v-card-text>
      </v-card>
    </v-container>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, type PropType } from 'vue'
import { useTheme } from 'vuetify'
import { Line as LineChart, Bar as BarChart, Doughnut } from 'vue-chartjs'
import { Options } from '@/model/Options'
import type { ChartData, ChartDataset } from 'chart.js'
import type { MetricsApiResponse } from '@/types/metricsApiResponse';
import type { Metrics } from '@/model/Metrics';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { ReportDayTotals, UserTotals } from '../../server/services/github-copilot-usage-api';
import { PALETTE } from '@/utils/chartPlugins'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

const FEATURE_DISPLAY: Record<string, string> = {
  code_completion: 'Completions',
  copilot_cli: 'CLI',
  agent_edit: 'Edit',
  chat_panel_ask_mode: 'Ask',
  chat_panel_agent_mode: 'Agent',
  chat_panel_custom_mode: 'Custom',
  chat_panel_edit_mode: 'Edit',
  chat_panel_plan_mode: 'Plan',
  chat_inline: 'Inline',
  plan_mode: 'Plan',
}
function featureLabel(key: string) {
  return FEATURE_DISPLAY[key] ?? key
}

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
)

interface DateRange { since?: string; until?: string }

interface Team {
  name: string
  slug: string
  description?: string
}

interface EnterpriseOrg {
  login: string
  name: string
}

interface PerTeamData {
  slug: string
  metrics: Metrics[]
  usage: CopilotMetrics[]
  reportData: ReportDayTotals[]
}

// Line metric keys for comparison mode
type LineMetricKey = 'acceptance_rate_by_count' | 'total_active_users'

const CHART_COLORS = [
  { bg: 'rgba(75, 192, 192, 0.2)', border: 'rgba(75, 192, 192, 1)' },
  { bg: 'rgba(153, 102, 255, 0.2)', border: 'rgba(153, 102, 255, 1)' },
  { bg: 'rgba(255, 159, 64, 0.2)', border: 'rgba(255, 159, 64, 1)' },
  { bg: 'rgba(255, 99, 132, 0.2)', border: 'rgba(255, 99, 132, 1)' },
  { bg: 'rgba(54, 162, 235, 0.2)', border: 'rgba(54, 162, 235, 1)' }
]

const DONUT_COLORS = ['#4BC0C0', '#9966FF', '#FF9F40', '#FF6384', '#36A2EB', '#FFCE56', '#4CAF50', '#E91E63', '#00BCD4', '#FF5722']

export default defineComponent({
  name: 'TeamsComponent',
  components: { LineChart, BarChart, Doughnut },
  props: {
    dateRange: { type: Object as PropType<DateRange>, required: false, default: () => ({}) },
    dateRangeDescription: { type: String, default: '' }
  },
  setup(props) {
    const theme = useTheme()
    const isDark = computed(() => theme.global.current.value.dark)
    const config = useRuntimeConfig()
    const isHistoricalMode = computed(() =>
      config.public?.enableHistoricalMode === true || config.public?.enableHistoricalMode === 'true'
    )

    const availableTeams = ref<Team[]>([])
    const selectedTeams = ref<string[]>([])
    const chartColumns = ref<'1' | '2'>('2')

    // ── Full GHEC org support ─────────────────────────────────────────────────
    const isFullGhec = ref(false)
    const availableOrgs = ref<EnterpriseOrg[]>([])
    const selectedOrg = ref<string | null>(null)

    // Core per-team data (reactive so computed values update)
    const perTeamData = ref<PerTeamData[]>([])

    // ── Modes ─────────────────────────────────────────────────────────────────
    const singleTeamMode = computed(() => selectedTeams.value.length === 1)
    const comparisonMode = computed(() => selectedTeams.value.length >= 2)

    const singleTeamName = computed(() => {
      if (!singleTeamMode.value) return ''
      const slug = selectedTeams.value[0]!
      return availableTeams.value.find(t => t.slug === slug)?.name || slug
    })

    // ── Chart options ──────────────────────────────────────────────────────────
    const compactLineOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: { y: { beginAtZero: true } },
      plugins: { legend: { position: 'bottom' as const, labels: { boxWidth: 10, font: { size: 11 } } } },
      layout: { padding: { left: 4, right: 4, top: 4, bottom: 4 } }
    }

    const donutOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { position: 'right' as const, labels: { boxWidth: 12, font: { size: 11 } } } }
    }

    const horizontalBarOptions = {
      indexAxis: 'y' as const,
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: { beginAtZero: true, ticks: { precision: 0 } },
        y: { ticks: { font: { size: 11 } } }
      },
      plugins: { legend: { display: false } }
    }

    const groupedBarOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { ticks: { maxRotation: 30, autoSkip: true, font: { size: 10 } } }
      },
      plugins: { legend: { position: 'top' as const, labels: { boxWidth: 10, font: { size: 11 } } } },
      layout: { padding: { left: 4, right: 4, top: 4, bottom: 4 } }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    const scopeType = computed(() => {
      const config = useRuntimeConfig()
      return config.public.scope === 'enterprise' ? 'enterprise' : 'organization'
    })

    const clearSelection = () => { selectedTeams.value = [] }

    const getTeamDetailUrl = (teamSlug: string) => {
      const config = useRuntimeConfig()
      // For enterprise scope with a selected org, navigate to the org-level team page
      if (scopeType.value === 'enterprise') {
        if (selectedOrg.value) {
          return `/orgs/${selectedOrg.value}/teams/${teamSlug}`
        }
        return `/enterprises/${config.public.githubEnt}/teams/${teamSlug}`
      }
      return `/orgs/${config.public.githubOrg}/teams/${teamSlug}`
    }

    // ── Language/editor aggregation helpers ───────────────────────────────────
    interface LangStats { suggestions: number; acceptances: number }
    interface EditorStats { interactions: number }

    const aggregateLangStats = (td: PerTeamData): Record<string, LangStats> => {
      const agg: Record<string, LangStats> = {}
      if (td.reportData.length) {
        td.reportData.forEach(d => {
          d.totals_by_language_feature?.forEach(lf => {
            if (!agg[lf.language]) agg[lf.language] = { suggestions: 0, acceptances: 0 }
            agg[lf.language]!.suggestions += lf.code_generation_activity_count || 0
            agg[lf.language]!.acceptances += lf.code_acceptance_activity_count || 0
          })
        })
      } else {
        td.metrics.forEach(m => {
          (m.breakdown || []).forEach(b => {
            if (!b.language) return
            if (!agg[b.language]) agg[b.language] = { suggestions: 0, acceptances: 0 }
            agg[b.language]!.suggestions += b.suggestions_count || 0
            agg[b.language]!.acceptances += b.acceptances_count || 0
          })
        })
      }
      return agg
    }

    const aggregateEditorStats = (td: PerTeamData): Record<string, EditorStats> => {
      const agg: Record<string, EditorStats> = {}
      if (td.reportData.length) {
        td.reportData.forEach(d => {
          d.totals_by_ide?.forEach(ide => {
            if (!agg[ide.ide]) agg[ide.ide] = { interactions: 0 }
            agg[ide.ide]!.interactions += ide.user_initiated_interaction_count || 0
          })
        })
      } else {
        td.metrics.forEach(m => {
          (m.breakdown || []).forEach(b => {
            if (!b.editor) return
            if (!agg[b.editor]) agg[b.editor] = { interactions: 0 }
            agg[b.editor]!.interactions += b.active_users || 0
          })
        })
      }
      return agg
    }

    // ── Single Team KPIs ──────────────────────────────────────────────────────
    const singleTeamKPIs = computed(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return []
      const td = perTeamData.value[0]

      let activeUsers = 0
      if (td.reportData.length) {
        const sorted = [...td.reportData].sort((a, b) => a.day.localeCompare(b.day))
        activeUsers = sorted.at(-1)?.daily_active_users || 0
      } else if (td.metrics.length) {
        const sorted = [...td.metrics].sort((a, b) => a.day.localeCompare(b.day))
        activeUsers = sorted.at(-1)?.total_active_users || 0
      }

      let totalGen = 0, totalAcc = 0
      if (td.reportData.length) {
        td.reportData.forEach(d => {
          totalGen += d.code_generation_activity_count || 0
          totalAcc += d.code_acceptance_activity_count || 0
        })
      } else {
        td.metrics.forEach(m => {
          totalGen += m.total_suggestions_count || 0
          totalAcc += m.total_acceptances_count || 0
        })
      }
      const acceptanceRate = totalGen ? ((totalAcc / totalGen) * 100).toFixed(1) : '—'

      const totalInteractions = td.reportData.reduce((s, d) => s + (d.user_initiated_interaction_count || 0), 0)

      const langAgg = aggregateLangStats(td)
      const topLang = Object.entries(langAgg).sort((a, b) => b[1].suggestions - a[1].suggestions)[0]?.[0] || '—'

      return [
        { label: 'Active Users', value: activeUsers, color: 'primary', subtitle: props.dateRangeDescription, tooltip: 'Daily active users on the latest available day' },
        { label: 'Acceptance Rate', value: `${acceptanceRate}%`, color: 'success', subtitle: 'Completions accepted ÷ generated', tooltip: 'Weighted code acceptance rate (acceptances ÷ generations) over the date range' },
        { label: 'Interactions', value: totalInteractions ? totalInteractions.toLocaleString() : (totalAcc + totalGen).toLocaleString(), color: 'primary', subtitle: 'User-initiated requests', tooltip: 'Total user-initiated Copilot interactions over the date range' },
        { label: 'Top Language', value: topLang, color: 'primary', subtitle: 'By code generation count', tooltip: 'Most active programming language by code generation count' }
      ]
    })

    // ── Single Team Time Series ───────────────────────────────────────────────
    const singleTeamAcceptanceRateData = computed<ChartData<'line', number[], string>>(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return { labels: [], datasets: [] }
      const td = perTeamData.value[0]
      const color = CHART_COLORS[0]!

      let days: string[] = []
      let values: number[] = []

      if (td.reportData.length) {
        const sorted = [...td.reportData].sort((a, b) => a.day.localeCompare(b.day))
        days = sorted.map(d => d.day)
        values = sorted.map(d =>
          d.code_generation_activity_count
            ? (d.code_acceptance_activity_count / d.code_generation_activity_count * 100)
            : 0
        )
      } else {
        const sorted = [...td.metrics].sort((a, b) => a.day.localeCompare(b.day))
        days = sorted.map(m => m.day)
        values = sorted.map(m => m.acceptance_rate_by_count || 0)
      }

      return {
        labels: days,
        datasets: [{ label: 'Acceptance Rate (%)', data: values, backgroundColor: color.bg, borderColor: color.border, tension: 0.1, fill: false }]
      }
    })

    const singleTeamActiveUsersData = computed<ChartData<'line', number[], string>>(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return { labels: [], datasets: [] }
      const td = perTeamData.value[0]
      const color = CHART_COLORS[1]!

      let days: string[] = []
      let values: number[] = []

      if (td.reportData.length) {
        const sorted = [...td.reportData].sort((a, b) => a.day.localeCompare(b.day))
        days = sorted.map(d => d.day)
        values = sorted.map(d => d.daily_active_users || 0)
      } else {
        const sorted = [...td.metrics].sort((a, b) => a.day.localeCompare(b.day))
        days = sorted.map(m => m.day)
        values = sorted.map(m => m.total_active_users || 0)
      }

      return {
        labels: days,
        datasets: [{ label: 'Active Users', data: values, backgroundColor: color.bg, borderColor: color.border, tension: 0.1, fill: false }]
      }
    })

    // ── Single Team Language Donut ─────────────────────────────────────────────
    const singleTeamLangDonutData = computed<ChartData<'doughnut', number[], string>>(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return { labels: [], datasets: [] }
      const agg = aggregateLangStats(perTeamData.value[0])
      const sorted = Object.entries(agg).sort((a, b) => b[1].suggestions - a[1].suggestions).slice(0, 10)
      if (!sorted.length) return { labels: [], datasets: [] }
      return {
        labels: sorted.map(([lang]) => lang),
        datasets: [{
          data: sorted.map(([, v]) => v.suggestions),
          backgroundColor: DONUT_COLORS.slice(0, sorted.length),
          borderWidth: 1
        }]
      }
    })

    const topLanguages = computed(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return []
      const agg = aggregateLangStats(perTeamData.value[0])
      return Object.entries(agg)
        .sort((a, b) => b[1].suggestions - a[1].suggestions)
        .slice(0, 15)
        .map(([language, vals]) => ({
          language,
          suggestions: vals.suggestions,
          rate: vals.suggestions ? (vals.acceptances / vals.suggestions * 100) : 0
        }))
    })

    // ── Single Team Editor Bar ─────────────────────────────────────────────────
    const singleTeamEditorBarData = computed<ChartData<'bar', number[], string>>(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return { labels: [], datasets: [] }
      const agg = aggregateEditorStats(perTeamData.value[0])
      const sorted = Object.entries(agg).sort((a, b) => b[1].interactions - a[1].interactions)
      if (!sorted.length) return { labels: [], datasets: [] }
      return {
        labels: sorted.map(([e]) => e),
        datasets: [{
          label: 'Interactions',
          data: sorted.map(([, v]) => v.interactions),
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          borderWidth: 1
        }]
      }
    })

    // ── Single Team Models ────────────────────────────────────────────────────
    const singleTeamModelsData = computed<ChartData<'bar', number[], string>>(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return { labels: [], datasets: [] }
      const td = perTeamData.value[0]
      const modelAgg: Record<string, number> = {}
      td.reportData.forEach(d => {
        d.totals_by_model_feature?.forEach(mf => {
          modelAgg[mf.model] = (modelAgg[mf.model] || 0) + (mf.user_initiated_interaction_count || 0)
        })
      })
      const sorted = Object.entries(modelAgg).sort((a, b) => b[1] - a[1]).slice(0, 8)
      if (!sorted.length) return { labels: [], datasets: [] }
      return {
        labels: sorted.map(([m]) => m),
        datasets: [{
          label: 'Interactions',
          data: sorted.map(([, v]) => v),
          backgroundColor: DONUT_COLORS.slice(0, sorted.length),
          borderWidth: 1
        }]
      }
    })

    // ── Model Usage Over Time ─────────────────────────────────────────────────
    const singleTeamModelUsageOverTimeData = computed<ChartData<'line', number[], string>>(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return { labels: [], datasets: [] }
      const data = perTeamData.value[0].reportData
      const modelKeys = [...new Set(
        data.flatMap(d => (d.totals_by_model_feature ?? [])
          .filter(mf => (mf.user_initiated_interaction_count ?? 0) > 0)
          .map(mf => mf.model))
      )]
      if (!modelKeys.length) return { labels: [], datasets: [] }
      return {
        labels: data.map(d => d.day),
        datasets: modelKeys.map((mk, i) => ({
          label: mk,
          data: data.map(d => (d.totals_by_model_feature ?? []).find(mf => mf.model === mk)?.user_initiated_interaction_count ?? 0),
          borderColor: PALETTE[i % PALETTE.length].border,
          backgroundColor: PALETTE[i % PALETTE.length].bg,
          fill: false,
          tension: 0.3,
        }))
      }
    })

    // ── Feature Usage Over Time ───────────────────────────────────────────────
    const singleTeamFeatureUsageData = computed<ChartData<'line', number[], string>>(() => {
      if (!singleTeamMode.value || !perTeamData.value[0]) return { labels: [], datasets: [] }
      const data = perTeamData.value[0].reportData
      const featureKeys = [...new Set(
        data.flatMap(d => (d.totals_by_feature ?? [])
          .filter(f => (f.user_initiated_interaction_count ?? 0) > 0)
          .map(f => f.feature ?? ''))
      )]
      if (!featureKeys.length) return { labels: [], datasets: [] }
      return {
        labels: data.map(d => d.day),
        datasets: featureKeys.map((fk, i) => ({
          label: featureLabel(fk),
          data: data.map(d => (d.totals_by_feature ?? []).find(f => f.feature === fk)?.user_initiated_interaction_count ?? 0),
          borderColor: PALETTE[i % PALETTE.length].border,
          backgroundColor: PALETTE[i % PALETTE.length].bg,
          fill: false,
          tension: 0.3,
        }))
      }
    })

    // ── Loading state ─────────────────────────────────────────────────────────
    const isLoading = ref(false)

    // ── User Metrics ──────────────────────────────────────────────────────────
    const singleTeamUserMetrics = ref<UserTotals[]>([])
    const userMetricsError = ref<string | null>(null)
    const userMetricsLoading = ref(false)

    const sortedUserMetrics = computed(() =>
      [...singleTeamUserMetrics.value].sort(
        (a, b) => b.user_initiated_interaction_count - a.user_initiated_interaction_count
      )
    )

    const loadUserMetricsForTeam = async (slug: string) => {
      userMetricsLoading.value = true
      userMetricsError.value = null
      singleTeamUserMetrics.value = []
      try {
        const route = useRoute()
        const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until)
        options.githubTeam = slug
        // Pass org override for Full GHEC org-level team membership lookup
        if (selectedOrg.value && scopeType.value === 'enterprise') {
          options.githubOrg = selectedOrg.value
        }
        const params = options.toParams()
        const result = await $fetch<UserTotals[]>('/api/user-metrics', { params })
        singleTeamUserMetrics.value = Array.isArray(result) ? result : []
      } catch (e: unknown) {
        const status = (e as { statusCode?: number; status?: number })?.statusCode
          ?? (e as { statusCode?: number; status?: number })?.status
        if (status === 503) {
          userMetricsError.value = 'Sign in with GitHub to view per-user metrics for this team.'
        } else {
          userMetricsError.value = 'User metrics unavailable for this team.'
        }
      } finally {
        userMetricsLoading.value = false
      }
    }

    // ── Comparison: per-team summary cards ────────────────────────────────────
    const comparisonSummaryCards = computed(() => {
      return perTeamData.value.map((td, idx) => {
        const teamName = availableTeams.value.find(t => t.slug === td.slug)?.name || td.slug

        let activeUsers = 0
        if (td.reportData.length) {
          const sorted = [...td.reportData].sort((a, b) => a.day.localeCompare(b.day))
          activeUsers = sorted.at(-1)?.daily_active_users || 0
        } else if (td.metrics.length) {
          const sorted = [...td.metrics].sort((a, b) => a.day.localeCompare(b.day))
          activeUsers = sorted.at(-1)?.total_active_users || 0
        }

        let totalGen = 0, totalAcc = 0
        if (td.reportData.length) {
          td.reportData.forEach(d => { totalGen += d.code_generation_activity_count || 0; totalAcc += d.code_acceptance_activity_count || 0 })
        } else {
          td.metrics.forEach(m => { totalGen += m.total_suggestions_count || 0; totalAcc += m.total_acceptances_count || 0 })
        }
        const acceptanceRate = totalGen ? ((totalAcc / totalGen) * 100).toFixed(1) : '—'
        const totalInteractions = td.reportData.reduce((s, d) => s + (d.user_initiated_interaction_count || 0), 0)
        const color = CHART_COLORS[idx % CHART_COLORS.length]!

        return { teamName, slug: td.slug, activeUsers, acceptanceRate, totalInteractions, color }
      })
    })

    // ── Comparison: chart data refs ────────────────────────────────────────────
    const acceptanceRateCountChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const activeUsersChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const languageBarChartData = ref<ChartData<'bar', number[], string>>({ labels: [], datasets: [] })
    const editorBarChartData = ref<ChartData<'bar', number[], string>>({ labels: [], datasets: [] })

    const comparisonModelsData = computed<ChartData<'bar', number[], string>>(() => {
      if (!comparisonMode.value) return { labels: [], datasets: [] }
      const allModels = new Set<string>()
      const teamModelData: Record<string, Record<string, number>> = {}
      perTeamData.value.forEach(td => {
        teamModelData[td.slug] = {}
        td.reportData.forEach(d => {
          d.totals_by_model_feature?.forEach(mf => {
            allModels.add(mf.model)
            teamModelData[td.slug]![mf.model] = (teamModelData[td.slug]![mf.model] || 0) + (mf.user_initiated_interaction_count || 0)
          })
        })
      })
      const models = Array.from(allModels).sort()
      if (!models.length) return { labels: [], datasets: [] }
      return {
        labels: models,
        datasets: perTeamData.value.map((td, idx) => {
          const colorIndex = idx % CHART_COLORS.length
          const teamName = availableTeams.value.find(t => t.slug === td.slug)?.name || td.slug
          return {
            label: teamName,
            data: models.map(m => teamModelData[td.slug]![m] || 0),
            backgroundColor: CHART_COLORS[colorIndex]!.border,
            borderColor: CHART_COLORS[colorIndex]!.border,
            borderWidth: 1
          }
        })
      }
    })

    // ── Data loading ──────────────────────────────────────────────────────────
    const loadEnterpriseOrgs = async () => {
      const route = useRoute()
      const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until)
      if (scopeType.value !== 'enterprise') return
      const params = options.toParams()
      try {
        const result = await $fetch<{ isFullGhec: boolean; orgs: EnterpriseOrg[] }>('/api/enterprise-orgs', { params })
        isFullGhec.value = result.isFullGhec
        availableOrgs.value = result.orgs
      } catch {
        isFullGhec.value = false
        availableOrgs.value = []
      }
    }

    const loadTeams = async (orgOverride?: string) => {
      const route = useRoute()
      const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until)
      // When an org is selected in enterprise context, list that org's teams
      if (orgOverride) {
        options.githubOrg = orgOverride
      }
      const params = options.toParams()
      const teams = await $fetch<Team[]>('/api/teams', { params })
      availableTeams.value = teams
    }

    const loadMetricsForTeam = async (teamSlug: string): Promise<PerTeamData> => {
      const route = useRoute()
      const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until)
      options.githubTeam = teamSlug
      // Pass org override for Full GHEC org-level team membership lookup
      if (selectedOrg.value && scopeType.value === 'enterprise') {
        options.githubOrg = selectedOrg.value
      }
      const params = options.toParams()
      const response = await $fetch<MetricsApiResponse>('/api/metrics', { params })
      return {
        slug: teamSlug,
        metrics: (response.metrics as Metrics[]) || [],
        usage: (response.usage as CopilotMetrics[]) || [],
        reportData: response.reportData || []
      }
    }

    const updateChartData = async () => {
      if (selectedTeams.value.length === 0) {
        perTeamData.value = []
        acceptanceRateCountChartData.value = { labels: [], datasets: [] }
        activeUsersChartData.value = { labels: [], datasets: [] }
        languageBarChartData.value = { labels: [], datasets: [] }
        editorBarChartData.value = { labels: [], datasets: [] }
        singleTeamUserMetrics.value = []
        userMetricsError.value = null
        isLoading.value = false
        return
      }

      isLoading.value = true
      try {
      const loaded = await Promise.all(selectedTeams.value.map(slug => loadMetricsForTeam(slug)))
      perTeamData.value = loaded

      // Build comparison line charts
      const daySet = new Set<string>()
      loaded.forEach(td => {
        td.metrics.forEach(m => { if (m.day) daySet.add(m.day) })
        td.usage.forEach(u => { if (u.date) daySet.add(u.date) })
      })
      const days = Array.from(daySet).sort()

      const getTeamName = (slug: string) => availableTeams.value.find(t => t.slug === slug)?.name || slug

      const makeLineDataset = (td: PerTeamData, key: LineMetricKey, label: string, idx: number): ChartDataset<'line', number[]> => {
        const color = CHART_COLORS[idx % CHART_COLORS.length]!
        return {
          label: `${getTeamName(td.slug)} — ${label}`,
          data: days.map(day => {
            const m = td.metrics.find(d => d.day === day)
            return m ? (m[key] || 0) : 0
          }),
          backgroundColor: color.bg,
          borderColor: color.border,
          tension: 0.1
        }
      }

      acceptanceRateCountChartData.value = {
        labels: days,
        datasets: loaded.map((td, i) => makeLineDataset(td, 'acceptance_rate_by_count', 'Acceptance Rate (%)', i))
      }
      activeUsersChartData.value = {
        labels: days,
        datasets: loaded.map((td, i) => makeLineDataset(td, 'total_active_users', 'Active Users', i))
      }

      // Language & editor grouped bar charts (comparison mode)
      const langComp: Array<{ team: string; language: string; acceptance_rate: number }> = []
      const editorComp: Array<{ team: string; editor: string; active_users: number }> = []

      loaded.forEach(td => {
        const langAgg = aggregateLangStats(td)
        Object.entries(langAgg).forEach(([language, vals]) => {
          const rate = vals.suggestions ? (vals.acceptances / vals.suggestions) * 100 : 0
          langComp.push({ team: td.slug, language, acceptance_rate: rate })
        })
        const editorAgg = aggregateEditorStats(td)
        Object.entries(editorAgg).forEach(([editor, vals]) => {
          editorComp.push({ team: td.slug, editor, active_users: vals.interactions })
        })
      })

      const allLanguages = [...new Set(langComp.map(l => l.language))]
      languageBarChartData.value = {
        labels: allLanguages,
        datasets: loaded.map((td, idx) => ({
          label: getTeamName(td.slug),
          data: allLanguages.map(lang => langComp.find(l => l.language === lang && l.team === td.slug)?.acceptance_rate || 0),
          backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]!.border,
          borderColor: CHART_COLORS[idx % CHART_COLORS.length]!.border,
          borderWidth: 1
        }))
      }

      const allEditors = [...new Set(editorComp.map(e => e.editor))]
      editorBarChartData.value = {
        labels: allEditors,
        datasets: loaded.map((td, idx) => ({
          label: getTeamName(td.slug),
          data: allEditors.map(editor => editorComp.find(e => e.editor === editor && e.team === td.slug)?.active_users || 0),
          backgroundColor: CHART_COLORS[idx % CHART_COLORS.length]!.border,
          borderColor: CHART_COLORS[idx % CHART_COLORS.length]!.border,
          borderWidth: 1
        }))
      }

      // For single team: load user metrics non-fatally
      if (singleTeamMode.value && selectedTeams.value[0]) {
        await loadUserMetricsForTeam(selectedTeams.value[0])
      } else {
        singleTeamUserMetrics.value = []
        userMetricsError.value = null
      }
      } finally {
        isLoading.value = false
      }
    }

    onMounted(async () => {
      // For enterprise scope, detect Full GHEC and load orgs before teams
      await loadEnterpriseOrgs()
      await loadTeams()
    })

    watch(selectedTeams, async () => { await updateChartData() })

    watch(selectedOrg, async (org) => {
      // When org selection changes, clear team selection and reload teams for that org
      selectedTeams.value = []
      try {
        await loadTeams(org || undefined)
      } catch {
        availableTeams.value = []
      }
    })

    watch(() => props.dateRange, async () => { await updateChartData() }, { deep: true })

    return {
      // state
      availableTeams,
      selectedTeams,
      isLoading,
      chartColumns,
      perTeamData,
      // Full GHEC org support
      isFullGhec,
      availableOrgs,
      selectedOrg,
      // modes
      singleTeamMode,
      comparisonMode,
      singleTeamName,
      // single team computed
      singleTeamKPIs,
      singleTeamAcceptanceRateData,
      singleTeamActiveUsersData,
      singleTeamLangDonutData,
      topLanguages,
      singleTeamEditorBarData,
      singleTeamModelsData,
      singleTeamModelUsageOverTimeData,
      singleTeamFeatureUsageData,
      // user metrics
      singleTeamUserMetrics,
      sortedUserMetrics,
      userMetricsError,
      userMetricsLoading,
      // comparison
      comparisonSummaryCards,
      comparisonModelsData,
      acceptanceRateCountChartData,
      activeUsersChartData,
      languageBarChartData,
      editorBarChartData,
      // chart options
      compactLineOptions,
      donutOptions,
      horizontalBarOptions,
      groupedBarOptions,
      // helpers
      scopeType,
      clearSelection,
      getTeamDetailUrl,
      isDark,
      isHistoricalMode,
      dateRangeDesc: props.dateRangeDescription
    }
  }
})
</script>

<style scoped>
:deep(.teams-select-menu) {
  max-height: 360px;
  overflow-y: auto;
  background-color: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  box-shadow: 0 6px 24px rgba(59, 75, 191, 0.15);
  border: 1px solid var(--app-accent-weak);
  z-index: 2000;
  border-radius: 8px;
  min-width: unset;
}

:deep(.teams-select-menu .v-list) {
  padding: 8px 0;
  background-color: transparent !important;
  color: inherit !important;
}

:deep(.teams-select-menu .v-list-item) {
  min-height: 40px;
  color: rgb(var(--v-theme-on-surface)) !important;
}

:deep(.teams-select-menu .v-list-item-title),
:deep(.teams-select-menu .v-list-item-subtitle) {
  color: rgb(var(--v-theme-on-surface)) !important;
}

:deep(.teams-select-menu .v-checkbox .v-selection-control) {
  align-items: center;
}

.lang-rate-table :deep(th) {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.lang-rate-table :deep(td) {
  font-size: 0.8rem;
}

.metric-tooltip {
  max-width: 300px;
}

.tooltip-text {
  font-size: 0.85rem;
}
</style>
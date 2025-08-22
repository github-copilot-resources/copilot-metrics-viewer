<template>
  <div>
    <!-- Team Selection Section -->
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card class="mb-4">
            <v-card-title class="text-h5">
              Teams Comparison
            </v-card-title>
            <v-card-subtitle>
              Select teams to compare metrics across your {{ scopeType }}
            </v-card-subtitle>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="8">
                  <v-select
v-model="selectedTeams" :items="availableTeams" item-value="slug"
                    label="Select teams to compare" multiple chips clearable variant="outlined" :menu-props="{
                      contentClass: 'teams-select-menu',
                      maxHeight: 360,
                      scrim: false,
                      closeOnContentClick: false,
                      offset: 8
                    }" :hint="`Select multiple teams from your ${scopeType} to compare their metrics`" persistent-hint>
                    <template #item="{ props, item }">
                      <v-list-item v-bind="props" :title="item.raw.name" :subtitle="item.raw.description" />
                    </template>
                    <template #chip="{ props, item }">
                      <v-chip v-bind="props" class="select-chip" :text="item.raw.name" closable />
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12" md="4" class="d-flex align-center">
                  <v-btn
v-if="selectedTeams.length > 0" color="primary" variant="outlined" size="small"
                    @click="clearSelection">
                    Clear All
                  </v-btn>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Selected Teams Quick Links -->
    <v-container v-if="selectedTeamObjects.length > 0">
      <v-row>
        <v-col cols="12">
          <v-card class="mb-4">
            <v-card-title class="text-h6">Selected Teams</v-card-title>
            <v-card-text>
              <v-chip-group>
                <v-chip
v-for="team in selectedTeamObjects" :key="team.slug" :href="getTeamDetailUrl(team.slug)"
                  class="selected-team-chip" target="_blank" link>
                  {{ team.name }} - View Details
                  <v-icon end>mdi-open-in-new</v-icon>
                </v-chip>
              </v-chip-group>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- Charts and Metrics Display -->
    <div v-if="selectedTeams.length > 0">
      <!-- Summary Cards -->
      <div class="tiles-container">
        <v-card
elevation="4" color="white" variant="elevated" class="mx-auto my-3"
          style="width: 300px; height: 175px;">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-25" />
              <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                <template #activator="{ props }">
                  <div v-bind="props" class="text-h6 mb-1">Teams Selected</div>
                </template>
                <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                  <span class="text-caption" style="font-size: 10px !important;">Number of teams currently selected for
                    comparison</span>
                </v-card>
              </v-tooltip>
              <div class="text-caption">{{ dateRangeDesc }}</div>
              <p class="text-h4">{{ selectedTeams.length }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card
elevation="4" color="white" variant="elevated" class="mx-auto my-3"
          style="width: 300px; height: 175px;">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10" />
              <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                <template #activator="{ props }">
                  <div v-bind="props" class="text-h6 mb-1">Total Active Users</div>
                </template>
                <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                  <span class="text-caption" style="font-size: 10px !important;">Combined total active users across all
                    selected teams</span>
                </v-card>
              </v-tooltip>
              <div class="text-caption">{{ dateRangeDesc }}</div>
              <p class="text-h4">{{ totalActiveUsers }}</p>
            </div>
          </v-card-item>
        </v-card>
      </div>

      <!-- Charts Section -->
      <v-main class="p-1" style="min-height: 300px;">
        <v-container style="min-height: 300px;" class="px-4 elevation-2">
          <!-- Acceptance Rate by Count Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Acceptance Rate by Count (%)</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Comparison of acceptance rates across
                selected
                teams over time</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="acceptanceRateCountChartData" :options="chartOptions" />

          <!-- Total Suggestions and Acceptances Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Total Suggestions Count | Total Acceptances Count</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Total suggestions and acceptances count
                over
                time for selected teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="suggestionsAcceptancesChartData" :options="chartOptions" />

          <!-- Acceptance Rate by Lines Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Acceptance Rate by Lines (%)</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Comparison of line-based acceptance rates
                across selected teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="acceptanceRateLinesChartData" :options="chartOptions" />

          <!-- Total Lines Suggested and Accepted Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Total Lines Suggested | Total Lines Accepted</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Total lines of code suggested and accepted
                over
                time for selected teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="linesSuggestedAcceptedChartData" :options="chartOptions" />

          <!-- Active Users Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Total Active Users</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Number of active users over time for
                selected
                teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="activeUsersChartData" :options="chartOptions" />

          <!-- Feature Usage Charts -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">IDE Code Completions Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with IDE code completions activity
                across
                selected teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="ideCompletionsChartData" :options="chartOptions" />

          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">IDE Chat Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with IDE chat activity across
                selected
                teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="ideChatChartData" :options="chartOptions" />

          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">GitHub.com Chat Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with GitHub.com chat activity across
                selected teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="githubChatChartData" :options="chartOptions" />

          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">GitHub.com PR Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with GitHub.com PR activity across
                selected teams</span>
            </v-card>
          </v-tooltip>
          <LineChart :data="githubPrChartData" :options="chartOptions" />
        </v-container>
      </v-main>

      <!-- Language and Editor Comparison Charts -->
      <v-container>
        <v-row>
          <v-col cols="12" md="6">
            <v-card class="pa-4">
              <v-card-title class="text-h6">Language Usage by Team</v-card-title>
              <v-card-text>
                <div v-if="languageBarChartData.datasets.length > 0" class="bar-chart-container">
                  <BarChart :data="languageBarChartData" :options="barChartOptions" />
                </div>
                <div v-else class="text-center text-medium-emphasis py-8">
                  <v-icon size="48" color="grey-lighten-1">mdi-chart-bar</v-icon>
                  <p class="mt-2">No language data available for selected teams</p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
          <v-col cols="12" md="6">
            <v-card class="pa-4">
              <v-card-title class="text-h6">Editor Usage by Team</v-card-title>
              <v-card-text>
                <div v-if="editorBarChartData.datasets.length > 0" class="bar-chart-container">
                  <BarChart :data="editorBarChartData" :options="barChartOptions" />
                </div>
                <div v-else class="text-center text-medium-emphasis py-8">
                  <v-icon size="48" color="grey-lighten-1">mdi-chart-bar</v-icon>
                  <p class="mt-2">No editor data available for selected teams</p>
                </div>
              </v-card-text>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </div>

    <!-- Empty State -->
    <v-container v-else>
      <v-row>
        <v-col cols="12">
          <v-card class="text-center pa-8">
            <v-card-text>
              <v-icon size="64" color="grey-lighten-1">mdi-account-group-outline</v-icon>
              <h3 class="text-h5 mt-4 mb-2">No Teams Selected</h3>
              <p class="text-body-1 text-medium-emphasis">
                Select one or more teams from the dropdown above to view and compare their metrics.
              </p>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch, onMounted, type PropType } from 'vue'
import { Line as LineChart, Bar as BarChart } from 'vue-chartjs'
import { Options } from '@/model/Options'
import type { ChartData, ChartDataset } from 'chart.js'
import type { MetricsApiResponse } from '@/types/metricsApiResponse';
import type { Metrics } from '@/model/Metrics';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
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

interface LanguageTeamData { team: string; language: string; acceptance_rate: number }
interface EditorTeamData { team: string; editor: string; active_users: number }

// Keys we will chart from the legacy Metrics object mapping
type LineMetricKey = 'acceptance_rate_by_count' | 'acceptance_rate_by_lines' | 'total_suggestions_count' | 'total_acceptances_count' | 'total_lines_suggested' | 'total_lines_accepted' | 'total_active_users'

export default defineComponent({
  name: 'TeamsComponent',
  components: { LineChart, BarChart },
  props: {
    dateRange: { type: Object as PropType<DateRange>, required: false, default: () => ({}) },
    dateRangeDescription: { type: String, default: '' }
  },
  setup(props) {
    const availableTeams = ref<Team[]>([])
    const selectedTeams = ref<string[]>([])

    const acceptanceRateCountChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const suggestionsAcceptancesChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const acceptanceRateLinesChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const linesSuggestedAcceptedChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const activeUsersChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const ideCompletionsChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const ideChatChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const githubChatChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })
    const githubPrChartData = ref<ChartData<'line', number[], string>>({ labels: [], datasets: [] })

    const languageComparison = ref<LanguageTeamData[]>([])
    const editorComparison = ref<EditorTeamData[]>([])
    const languageBarChartData = ref<ChartData<'bar', number[], string>>({ labels: [], datasets: [] })
    const editorBarChartData = ref<ChartData<'bar', number[], string>>({ labels: [], datasets: [] })

    const chartOptions = {
      responsive: true,
      maintainAspectRatio: true,
      scales: { y: { beginAtZero: true } },
      layout: { padding: { left: 50, right: 50, top: 50, bottom: 50 } }
    }
    const barChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: { beginAtZero: true, ticks: { precision: 0 } },
        x: { ticks: { maxRotation: 0, autoSkip: true } }
      },
      plugins: { legend: { position: 'top' as const } },
      layout: { padding: { left: 12, right: 12, top: 8, bottom: 8 } },
      elements: { bar: { borderWidth: 1 } }
    }

    const selectedTeamObjects = computed(() => availableTeams.value.filter(team => selectedTeams.value.includes(team.slug)))
    const scopeType = computed(() => {
      const config = useRuntimeConfig()
      return config.public.scope === 'enterprise' ? 'enterprise' : 'organization'
    })
  // Aggregate total active users across selected teams (latest day for each)
  const aggregatedTotalActiveUsers = ref(0)
  const totalActiveUsers = computed(() => aggregatedTotalActiveUsers.value)

    const clearSelection = () => { selectedTeams.value = [] }
    const getTeamDetailUrl = (teamSlug: string) => {
      const config = useRuntimeConfig()
      return config.public.scope === 'enterprise'
        ? `/enterprises/${config.public.githubEnt}/teams/${teamSlug}`
        : `/orgs/${config.public.githubOrg}/teams/${teamSlug}`
    }


    const loadTeams = async () => {
      const route = useRoute();
      const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until);
      const params = options.toParams();

      const teams = await $fetch<Team[]>('/api/teams', { params })
      availableTeams.value = teams
    }
    // Load metrics for a single team via /api/metrics (old + new formats)
    const loadMetricsForTeam = async (teamSlug: string) => {
      const route = useRoute();
      const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until);
      // Force scope to team variant based on current broader scope
      if (options.scope === 'enterprise') options.scope = 'team-enterprise';
      else if (options.scope === 'organization') options.scope = 'team-organization';
      options.githubTeam = teamSlug;
      const params = options.toParams();
      const response = await $fetch<MetricsApiResponse>('/api/metrics', { params })
      return response;
    }

    const generateBarChartData = () => {
      // Generate language bar chart data
      const languages = [...new Set(languageComparison.value.map(l => l.language))]
      const teams = [...new Set(languageComparison.value.map(l => l.team))]

      const languageDatasets = teams.map((team, index) => {
        const colorIndex = index % teamColors.length
        return {
          label: team,
          data: languages.map(language => {
            const langData = languageComparison.value.find(l => l.language === language && l.team === team)
            return langData ? langData.acceptance_rate : 0
          }),
          backgroundColor: teamColors[colorIndex]!.border,
          borderColor: teamColors[colorIndex]!.border,
          borderWidth: 1
        }
      })

      languageBarChartData.value = {
        labels: languages,
        datasets: languageDatasets
      }

      // Generate editor bar chart data
      const editors = [...new Set(editorComparison.value.map(e => e.editor))]

      const editorDatasets = teams.map((team, index) => {
        const colorIndex = index % teamColors.length
        return {
          label: team,
          data: editors.map(editor => {
            const editorData = editorComparison.value.find(e => e.editor === editor && e.team === team)
            return editorData ? editorData.active_users : 0
          }),
          backgroundColor: teamColors[colorIndex]!.border,
          borderColor: teamColors[colorIndex]!.border,
          borderWidth: 1
        }
      })

      editorBarChartData.value = {
        labels: editors,
        datasets: editorDatasets
      }
    }

    // Chart colors for different teams
    const teamColors = [
      { bg: 'rgba(75, 192, 192, 0.2)', border: 'rgba(75, 192, 192, 1)' },
      { bg: 'rgba(153, 102, 255, 0.2)', border: 'rgba(153, 102, 255, 1)' },
      { bg: 'rgba(255, 159, 64, 0.2)', border: 'rgba(255, 159, 64, 1)' },
      { bg: 'rgba(255, 99, 132, 0.2)', border: 'rgba(255, 99, 132, 1)' },
      { bg: 'rgba(54, 162, 235, 0.2)', border: 'rgba(54, 162, 235, 1)' }
    ]

  const updateChartData = async () => {
      if (selectedTeams.value.length === 0) {
        // Clear all charts
        acceptanceRateCountChartData.value = { labels: [], datasets: [] }
        suggestionsAcceptancesChartData.value = { labels: [], datasets: [] }
        acceptanceRateLinesChartData.value = { labels: [], datasets: [] }
        linesSuggestedAcceptedChartData.value = { labels: [], datasets: [] }
        activeUsersChartData.value = { labels: [], datasets: [] }
        ideCompletionsChartData.value = { labels: [], datasets: [] }
        ideChatChartData.value = { labels: [], datasets: [] }
        githubChatChartData.value = { labels: [], datasets: [] }
        githubPrChartData.value = { labels: [], datasets: [] }
        languageComparison.value = []
        editorComparison.value = []
        languageBarChartData.value = { labels: [], datasets: [] }
        editorBarChartData.value = { labels: [], datasets: [] }
        return
      }

      // Fetch metrics for each selected team individually
      const perTeamResponses = await Promise.all(selectedTeams.value.map(slug => loadMetricsForTeam(slug)))

      // Build a structure for quick lookup
      interface PerTeamData { slug: string; metrics: Metrics[]; usage: CopilotMetrics[] }
      const perTeamData: PerTeamData[] = perTeamResponses.map((resp, idx) => ({
        slug: selectedTeams.value[idx]!,
        metrics: (resp.metrics as Metrics[]) || [],
        usage: (resp.usage as CopilotMetrics[]) || []
      }))

      // Collect unique days across all teams
      const daySet = new Set<string>()
  perTeamData.forEach(t => t.metrics.forEach((m) => { if (m.day) daySet.add(m.day) }))
      // usage array uses 'date' property; ensure inclusion if metrics empty
  perTeamData.forEach(t => t.usage.forEach((u) => { if (u.date) daySet.add(u.date) }))
      const days = Array.from(daySet).sort()

      const getTeamName = (slug: string) => availableTeams.value.find(t => t.slug === slug)?.name || slug

      // Helper to create line datasets pulling from Metrics objects
      const createMetricsDatasets = (metricKey: LineMetricKey, label: string): ChartDataset<'line', number[]>[] => {
        return perTeamData.map((teamData, index) => {
          const teamName = getTeamName(teamData.slug)
          const colorIndex = index % teamColors.length
          return {
            label: `${teamName} - ${label}`,
            data: days.map(day => {
              const dayData = teamData.metrics.find((d) => d.day === day)
              return dayData ? (dayData[metricKey] || 0) : 0
            }),
            backgroundColor: teamColors[colorIndex]!.bg,
            borderColor: teamColors[colorIndex]!.border,
            tension: 0.1
          }
        })
      }

      acceptanceRateCountChartData.value = {
        labels: days,
        datasets: createMetricsDatasets('acceptance_rate_by_count', 'Acceptance Rate (%)')
      }

      // Suggestions & Acceptances datasets
      const suggestionsDatasets: ChartDataset<'line', number[]>[] = []
      perTeamData.forEach((teamData, index) => {
        const teamName = getTeamName(teamData.slug)
        const colorIndex = index % teamColors.length
        const suggestionsDataset: ChartDataset<'line', number[]> = {
          label: `${teamName} - Suggestions`,
          data: days.map(day => {
            const dayData = teamData.metrics.find((d) => d.day === day)
            return dayData ? (dayData.total_suggestions_count || 0) : 0
          }),
          backgroundColor: teamColors[colorIndex]!.bg,
          borderColor: teamColors[colorIndex]!.border,
          tension: 0.1
        }
        const acceptancesDataset: ChartDataset<'line', number[]> = {
          label: `${teamName} - Acceptances`,
          data: days.map(day => {
            const dayData = teamData.metrics.find((d) => d.day === day)
            return dayData ? (dayData.total_acceptances_count || 0) : 0
          }),
          backgroundColor: teamColors[colorIndex]!.bg,
          borderColor: teamColors[colorIndex]!.border,
          borderDash: [5, 5],
          tension: 0.1
        }
        suggestionsDatasets.push(suggestionsDataset, acceptancesDataset)
      })
      suggestionsAcceptancesChartData.value = { labels: days, datasets: suggestionsDatasets }

      acceptanceRateLinesChartData.value = {
        labels: days,
        datasets: createMetricsDatasets('acceptance_rate_by_lines', 'Acceptance Rate Lines (%)')
      }

      // Lines suggested & accepted
      const linesDatasets: ChartDataset<'line', number[]>[] = []
      perTeamData.forEach((teamData, index) => {
        const teamName = getTeamName(teamData.slug)
        const colorIndex = index % teamColors.length
        linesDatasets.push(
          {
            label: `${teamName} - Lines Suggested`,
            data: days.map(day => {
              const dayData = teamData.metrics.find((d) => d.day === day)
              return dayData ? (dayData.total_lines_suggested || 0) : 0
            }),
            backgroundColor: teamColors[colorIndex]!.bg,
            borderColor: teamColors[colorIndex]!.border,
            tension: 0.1
          },
          {
            label: `${teamName} - Lines Accepted`,
            data: days.map(day => {
              const dayData = teamData.metrics.find((d) => d.day === day)
              return dayData ? (dayData.total_lines_accepted || 0) : 0
            }),
            backgroundColor: teamColors[colorIndex]!.bg,
            borderColor: teamColors[colorIndex]!.border,
            borderDash: [5, 5],
            tension: 0.1
          }
        )
      })
      linesSuggestedAcceptedChartData.value = { labels: days, datasets: linesDatasets }

      activeUsersChartData.value = {
        labels: days,
        datasets: createMetricsDatasets('total_active_users', 'Active Users')
      }

      // Feature usage charts derived from NEW usage format (CopilotMetrics)
      const createUsageDataset = (path: string[], label: string): ChartDataset<'line', number[]>[] => {
        return perTeamData.map((teamData, index) => {
          const teamName = getTeamName(teamData.slug)
            const colorIndex = index % teamColors.length
            return {
              label: `${teamName} - ${label}`,
              data: days.map(day => {
                const usageDay = teamData.usage.find((u) => u.date === day)
                if (!usageDay) return 0
                // Traverse path for nested value
                let val: unknown = usageDay
                for (const segment of path) {
                  // Dynamic traversal through nested objects using optional chaining
                  val = val?.[segment]
                  if (val == null) break
                }
                return (typeof val === 'number') ? val : 0
              }),
              backgroundColor: teamColors[colorIndex]!.bg,
              borderColor: teamColors[colorIndex]!.border,
              tension: 0.1
            }
        })
      }

      ideCompletionsChartData.value = { labels: days, datasets: createUsageDataset(['copilot_ide_code_completions', 'total_engaged_users'], 'IDE Completions Users') }
      ideChatChartData.value = { labels: days, datasets: createUsageDataset(['copilot_ide_chat', 'total_engaged_users'], 'IDE Chat Users') }
      githubChatChartData.value = { labels: days, datasets: createUsageDataset(['copilot_dotcom_chat', 'total_engaged_users'], 'GitHub Chat Users') }
      githubPrChartData.value = { labels: days, datasets: createUsageDataset(['copilot_dotcom_pull_requests', 'total_engaged_users'], 'GitHub PR Users') }

      // Derive language & editor comparisons from breakdown across all days per team
      const langComp: LanguageTeamData[] = []
      const editorComp: EditorTeamData[] = []
      perTeamData.forEach(teamData => {
        const langAgg: Record<string, { suggestions: number; acceptances: number }> = {}
        const editorAgg: Record<string, number> = {}
        teamData.metrics.forEach((m) => {
          (m.breakdown || []).forEach((b) => {
            if (b.language) {
              if (!langAgg[b.language]) langAgg[b.language] = { suggestions: 0, acceptances: 0 }
              langAgg[b.language].suggestions += b.suggestions_count || 0
              langAgg[b.language].acceptances += b.acceptances_count || 0
            }
            if (b.editor) {
              editorAgg[b.editor] = (editorAgg[b.editor] || 0) + (b.active_users || 0)
            }
          })
        })
        Object.entries(langAgg).forEach(([language, vals]) => {
          const rate = vals.suggestions ? (vals.acceptances / vals.suggestions) * 100 : 0
          langComp.push({ team: teamData.slug, language, acceptance_rate: rate })
        })
        Object.entries(editorAgg).forEach(([editor, active]) => {
          editorComp.push({ team: teamData.slug, editor, active_users: active })
        })
      })
      languageComparison.value = langComp
      editorComparison.value = editorComp
      generateBarChartData()

      // Update total active users (latest day per team)
      let totalActive = 0
      perTeamData.forEach(teamData => {
        if (teamData.metrics.length) {
          const latest = [...teamData.metrics].sort((a, b) => a.day.localeCompare(b.day)).at(-1)
          totalActive += latest?.total_active_users || 0
        }
      })
      aggregatedTotalActiveUsers.value = totalActive
    }

    // Load teams on mount, then react to selection changes
    onMounted(async () => { await loadTeams() })
    watch(selectedTeams, async () => { await updateChartData() })
    watch(() => props.dateRange, async () => {
      // When date range changes, reload charts with new params
      await updateChartData()
    }, { deep: true })

    return {
      // derived props to avoid duplicate key in template scope
      dateRangeDesc: props.dateRangeDescription,
      // state
      availableTeams,
      selectedTeams,
      acceptanceRateCountChartData,
      suggestionsAcceptancesChartData,
      acceptanceRateLinesChartData,
      linesSuggestedAcceptedChartData,
      activeUsersChartData,
      ideCompletionsChartData,
      ideChatChartData,
      githubChatChartData,
      githubPrChartData,
      languageComparison,
      editorComparison,
      languageBarChartData,
      editorBarChartData,
      chartOptions,
      barChartOptions,
      selectedTeamObjects,
      scopeType,
  totalActiveUsers,
      clearSelection,
      getTeamDetailUrl,
      generateBarChartData,
  loadTeams
    }
  }
})
</script>

<style scoped>
:deep(.teams-select-menu) {
  max-height: 360px;
  overflow-y: auto;
  background-color: var(--v-theme-surface, #fff) !important;
  box-shadow: 0 6px 24px rgba(59, 75, 191, 0.15);
  border: 1px solid var(--app-accent-weak);
  z-index: 2000;
  border-radius: 8px;
  min-width: unset;
}

:deep(.teams-select-menu .v-list) {
  padding: 8px 0;
}

:deep(.teams-select-menu .v-list-item) {
  min-height: 40px;
}

:deep(.teams-select-menu .v-checkbox .v-selection-control) {
  align-items: center;
}

.tiles-container {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: flex-start;
  gap: 16px;
  margin: 16px 0;
}

.tiles-text {
  text-align: center;
  padding: 8px;
}

.spacing-25 {
  height: 25px;
}

.spacing-10 {
  height: 10px;
}

.bar-chart-container {
  position: relative;
  height: 320px; /* Increased height for better visibility */
  /* Allow responsive shrink on very narrow screens */
  max-height: 60vh;
}
</style>
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
                    v-model="selectedTeams"
                    :items="availableTeams"
                    item-title="name"
                    item-value="slug"
                    label="Select teams to compare"
                    multiple
                    chips
                    clearable
                    variant="outlined"
                    :menu-props="{
                      contentClass: 'teams-select-menu',
                      maxHeight: 360,
                      scrim: false,
                      closeOnContentClick: false,
                      offset: 8
                    }"
                    :hint="`Select multiple teams from your ${scopeType} to compare their metrics`"
                    persistent-hint
                  >
                    <template #chip="{ props, item }">
                      <v-chip
                        v-bind="props"
                        class="select-chip"
                        :text="item.raw.name"
                        closable
                      />
                    </template>
                  </v-select>
                </v-col>
                <v-col cols="12" md="4" class="d-flex align-center">
                  <v-btn
                    v-if="selectedTeams.length > 0"
                    color="primary"
                    variant="outlined"
                    size="small"
                    @click="clearSelection"
                  >
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
                  v-for="team in selectedTeamObjects"
                  :key="team.slug"
                  :href="getTeamDetailUrl(team.slug)"
                  class="selected-team-chip"
                  target="_blank"
                  link
                >
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
        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-25"/>
              <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                <template #activator="{ props }">
                  <div v-bind="props" class="text-h6 mb-1">Teams Selected</div>
                </template>
                <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                  <span class="text-caption" style="font-size: 10px !important;">Number of teams currently selected for comparison</span>
                </v-card>
              </v-tooltip>
              <div class="text-caption">{{ dateRangeDescription }}</div>
              <p class="text-h4">{{ selectedTeams.length }}</p>
            </div>
          </v-card-item>
        </v-card>

        <v-card elevation="4" color="white" variant="elevated" class="mx-auto my-3" style="width: 300px; height: 175px;">
          <v-card-item>
            <div class="tiles-text">
              <div class="spacing-10"/>
              <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
                <template #activator="{ props }">
                  <div v-bind="props" class="text-h6 mb-1">Total Active Users</div>
                </template>
                <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
                  <span class="text-caption" style="font-size: 10px !important;">Combined total active users across all selected teams</span>
                </v-card>
              </v-tooltip>
              <div class="text-caption">{{ dateRangeDescription }}</div>
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
              <span class="text-caption" style="font-size: 10px !important;">Comparison of acceptance rates across selected teams over time</span>
            </v-card>
          </v-tooltip>
          <Line :data="acceptanceRateCountChartData" :options="chartOptions" />

          <!-- Total Suggestions and Acceptances Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Total Suggestions Count | Total Acceptances Count</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Total suggestions and acceptances count over time for selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="suggestionsAcceptancesChartData" :options="chartOptions" />

          <!-- Acceptance Rate by Lines Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Acceptance Rate by Lines (%)</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Comparison of line-based acceptance rates across selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="acceptanceRateLinesChartData" :options="chartOptions" />

          <!-- Total Lines Suggested and Accepted Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Total Lines Suggested | Total Lines Accepted</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Total lines of code suggested and accepted over time for selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="linesSuggestedAcceptedChartData" :options="chartOptions" />

          <!-- Active Users Chart -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">Total Active Users</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Number of active users over time for selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="activeUsersChartData" :options="chartOptions" />

          <!-- Feature Usage Charts -->
          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">IDE Code Completions Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with IDE code completions activity across selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="ideCompletionsChartData" :options="chartOptions" />

          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">IDE Chat Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with IDE chat activity across selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="ideChatChartData" :options="chartOptions" />

          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">GitHub.com Chat Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with GitHub.com chat activity across selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="githubChatChartData" :options="chartOptions" />

          <v-tooltip location="bottom start" open-on-hover open-delay="200" close-delay="200">
            <template #activator="{ props }">
              <h2 v-bind="props" class="mb-1">GitHub.com PR Usage</h2>
            </template>
            <v-card class="pa-2" style="background-color: #f0f0f0; max-width: 350px;">
              <span class="text-caption" style="font-size: 10px !important;">Users with GitHub.com PR activity across selected teams</span>
            </v-card>
          </v-tooltip>
          <Line :data="githubPrChartData" :options="chartOptions" />
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
                  <Bar :data="languageBarChartData" :options="barChartOptions" />
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
                  <Bar :data="editorBarChartData" :options="barChartOptions" />
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

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Line, Bar } from 'vue-chartjs'
import type { Metrics } from '@/model/Metrics'
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

interface Props {
  dateRangeDescription: string
}

const props = defineProps<Props>()

interface Team {
  name: string
  slug: string
}

interface TeamMetrics {
  team: string
  day: string
  acceptance_rate_count: number
  acceptance_rate_lines: number
  total_suggestions: number
  total_acceptances: number
  total_lines_suggested: number
  total_lines_accepted: number
  total_active_users: number
  ide_completions_users: number
  ide_chat_users: number
  github_chat_users: number
  github_pr_users: number
}

interface LanguageTeamData {
  team: string
  language: string
  acceptance_rate: number
}

interface EditorTeamData {
  team: string
  editor: string
  active_users: number
}

// Available teams (mock data - would come from API)
const availableTeams = ref<Team[]>([
  { name: 'The A Team', slug: 'the-a-team' },
  { name: 'Development Team', slug: 'dev-team' },
  { name: 'Frontend Team', slug: 'frontend-team' },
  { name: 'Backend Team', slug: 'backend-team' },
  { name: 'QA Team', slug: 'qa-team' }
])

// Selected teams
const selectedTeams = ref<string[]>([])

// Chart data refs
const acceptanceRateCountChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const suggestionsAcceptancesChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const acceptanceRateLinesChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const linesSuggestedAcceptedChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const activeUsersChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const ideCompletionsChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const ideChatChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const githubChatChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const githubPrChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })

// Language and editor comparison data
const languageComparison = ref<LanguageTeamData[]>([])
const editorComparison = ref<EditorTeamData[]>([])

// Bar chart data refs
const languageBarChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })
const editorBarChartData = ref<{ labels: string[]; datasets: any[] }>({ labels: [], datasets: [] })

// Chart options
const chartOptions = {
  responsive: true,
  maintainAspectRatio: true,
  scales: {
    y: {
      beginAtZero: true
    }
  },
  layout: {
    padding: {
      left: 50,
      right: 50,
      top: 50,
      bottom: 50
    }
  }
}

// Bar chart options
const barChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    y: {
      beginAtZero: true,
      ticks: { precision: 0 }
    },
    x: {
      ticks: { maxRotation: 0, autoSkip: true }
    }
  },
  plugins: {
    legend: { position: 'top' as const }
  },
  layout: {
    padding: { left: 12, right: 12, top: 8, bottom: 8 }
  },
  elements: {
    bar: { borderWidth: 1 }
  }
}

// Computed properties
const selectedTeamObjects = computed(() => {
  return availableTeams.value.filter(team => selectedTeams.value.includes(team.slug))
})

const scopeType = computed(() => {
  const config = useRuntimeConfig()
  if (config.public.scope === 'enterprise') return 'enterprise'
  return 'organization'
})

const totalActiveUsers = computed(() => {
  if (selectedTeams.value.length === 0) return 0
  // This would be calculated from actual team metrics
  return selectedTeams.value.length * 15 // Mock calculation
})

// Functions
const clearSelection = () => {
  selectedTeams.value = []
}

const getTeamDetailUrl = (teamSlug: string) => {
  const config = useRuntimeConfig()
  if (config.public.scope === 'enterprise') {
    return `/enterprises/${config.public.githubEnt}/teams/${teamSlug}`
  }
  return `/orgs/${config.public.githubOrg}/teams/${teamSlug}`
}

// Mock team metrics data generation
const generateMockTeamMetrics = (teamSlug: string): TeamMetrics[] => {
  const days = ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07']
  return days.map(day => ({
    team: teamSlug,
    day,
    acceptance_rate_count: 70 + Math.random() * 20,
    acceptance_rate_lines: 65 + Math.random() * 25,
    total_suggestions: Math.floor(100 + Math.random() * 200),
    total_acceptances: Math.floor(70 + Math.random() * 150),
    total_lines_suggested: Math.floor(500 + Math.random() * 1000),
    total_lines_accepted: Math.floor(350 + Math.random() * 700),
    total_active_users: Math.floor(10 + Math.random() * 15),
    ide_completions_users: Math.floor(8 + Math.random() * 12),
    ide_chat_users: Math.floor(5 + Math.random() * 8),
    github_chat_users: Math.floor(3 + Math.random() * 6),
    github_pr_users: Math.floor(2 + Math.random() * 5)
  }))
}

const generateMockLanguageData = () => {
  const languages = ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go']
  const result: LanguageTeamData[] = []
  
  selectedTeams.value.forEach(teamSlug => {
    const teamName = availableTeams.value.find(t => t.slug === teamSlug)?.name || teamSlug
    languages.forEach(language => {
      if (Math.random() > 0.3) { // Not all teams use all languages
        result.push({
          team: teamName,
          language,
          acceptance_rate: 65 + Math.random() * 25
        })
      }
    })
  })
  
  return result
}

const generateMockEditorData = () => {
  const editors = ['VS Code', 'IntelliJ IDEA', 'WebStorm', 'PyCharm', 'GoLand']
  const result: EditorTeamData[] = []
  
  selectedTeams.value.forEach(teamSlug => {
    const teamName = availableTeams.value.find(t => t.slug === teamSlug)?.name || teamSlug
    editors.forEach(editor => {
      if (Math.random() > 0.4) { // Not all teams use all editors
        result.push({
          team: teamName,
          editor,
          active_users: Math.floor(1 + Math.random() * 8)
        })
      }
    })
  })
  
  return result
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
      backgroundColor: teamColors[colorIndex].border,
      borderColor: teamColors[colorIndex].border,
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
      backgroundColor: teamColors[colorIndex].border,
      borderColor: teamColors[colorIndex].border,
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

const updateChartData = () => {
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

  // Generate mock data for all selected teams
  const allTeamMetrics: TeamMetrics[] = []
  selectedTeams.value.forEach(teamSlug => {
    allTeamMetrics.push(...generateMockTeamMetrics(teamSlug))
  })

  // Get unique days for labels
  const days = [...new Set(allTeamMetrics.map(m => m.day))].sort()

  // Create datasets for each team
  const createTeamDatasets = (metricKey: keyof TeamMetrics, label: string) => {
    return selectedTeams.value.map((teamSlug, index) => {
      const teamName = availableTeams.value.find(t => t.slug === teamSlug)?.name || teamSlug
      const teamData = allTeamMetrics.filter(m => m.team === teamSlug)
      const colorIndex = index % teamColors.length
      
      return {
        label: `${teamName} - ${label}`,
        data: days.map(day => {
          const dayData = teamData.find(d => d.day === day)
          return dayData ? dayData[metricKey] : 0
        }),
        backgroundColor: teamColors[colorIndex].bg,
        borderColor: teamColors[colorIndex].border,
        tension: 0.1
      }
    })
  }

  // Update all chart data
  acceptanceRateCountChartData.value = {
    labels: days,
    datasets: createTeamDatasets('acceptance_rate_count', 'Acceptance Rate (%)')
  }

  // For suggestions and acceptances, create two datasets per team
  const suggestionsDatasets = selectedTeams.value.flatMap((teamSlug, index) => {
    const teamName = availableTeams.value.find(t => t.slug === teamSlug)?.name || teamSlug
    const teamData = allTeamMetrics.filter(m => m.team === teamSlug)
    const colorIndex = index % teamColors.length
    
    return [
      {
        label: `${teamName} - Suggestions`,
        data: days.map(day => {
          const dayData = teamData.find(d => d.day === day)
          return dayData ? dayData.total_suggestions : 0
        }),
        backgroundColor: teamColors[colorIndex].bg,
        borderColor: teamColors[colorIndex].border,
        tension: 0.1
      },
      {
        label: `${teamName} - Acceptances`,
        data: days.map(day => {
          const dayData = teamData.find(d => d.day === day)
          return dayData ? dayData.total_acceptances : 0
        }),
        backgroundColor: teamColors[colorIndex].bg,
        borderColor: teamColors[colorIndex].border,
        borderDash: [5, 5], // Dashed line for acceptances
        tension: 0.1
      }
    ]
  })

  suggestionsAcceptancesChartData.value = {
    labels: days,
    datasets: suggestionsDatasets
  }

  acceptanceRateLinesChartData.value = {
    labels: days,
    datasets: createTeamDatasets('acceptance_rate_lines', 'Acceptance Rate Lines (%)')
  }

  // Lines suggested and accepted
  const linesDatasets = selectedTeams.value.flatMap((teamSlug, index) => {
    const teamName = availableTeams.value.find(t => t.slug === teamSlug)?.name || teamSlug
    const teamData = allTeamMetrics.filter(m => m.team === teamSlug)
    const colorIndex = index % teamColors.length
    
    return [
      {
        label: `${teamName} - Lines Suggested`,
        data: days.map(day => {
          const dayData = teamData.find(d => d.day === day)
          return dayData ? dayData.total_lines_suggested : 0
        }),
        backgroundColor: teamColors[colorIndex].bg,
        borderColor: teamColors[colorIndex].border,
        tension: 0.1
      },
      {
        label: `${teamName} - Lines Accepted`,
        data: days.map(day => {
          const dayData = teamData.find(d => d.day === day)
          return dayData ? dayData.total_lines_accepted : 0
        }),
        backgroundColor: teamColors[colorIndex].bg,
        borderColor: teamColors[colorIndex].border,
        borderDash: [5, 5],
        tension: 0.1
      }
    ]
  })

  linesSuggestedAcceptedChartData.value = {
    labels: days,
    datasets: linesDatasets
  }

  activeUsersChartData.value = {
    labels: days,
    datasets: createTeamDatasets('total_active_users', 'Active Users')
  }

  ideCompletionsChartData.value = {
    labels: days,
    datasets: createTeamDatasets('ide_completions_users', 'IDE Completions Users')
  }

  ideChatChartData.value = {
    labels: days,
    datasets: createTeamDatasets('ide_chat_users', 'IDE Chat Users')
  }

  githubChatChartData.value = {
    labels: days,
    datasets: createTeamDatasets('github_chat_users', 'GitHub Chat Users')
  }

  githubPrChartData.value = {
    labels: days,
    datasets: createTeamDatasets('github_pr_users', 'GitHub PR Users')
  }

  // Update comparison tables
  languageComparison.value = generateMockLanguageData()
  editorComparison.value = generateMockEditorData()
  
  // Generate bar chart data
  generateBarChartData()
}

// Watch for changes in selected teams and update charts
watch(selectedTeams, updateChartData, { immediate: true })
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

/* Ensure Bar charts scale correctly within their cards */
.bar-chart-container {
  position: relative;
  width: 100%;
  /* Responsive height: min 240px, prefer 40vh, cap at 380px */
  height: clamp(240px, 40vh, 380px);
}
.bar-chart-container canvas {
  width: 100% !important;
  height: 100% !important;
}

@media (max-width: 960px) {
  .bar-chart-container {
    height: clamp(220px, 35vh, 340px);
  }
}

/* Selected chips: light blue background, black text */
:deep(.v-select .v-chip),
:deep(.v-select .v-chip--selected) {
  background-color: var(--app-accent-weak) !important;
  color: #000 !important;
  border-color: var(--app-accent-weak) !important;
}
:deep(.v-select .v-chip .v-chip__overlay),
:deep(.v-select .v-chip--selected .v-chip__overlay) {
  background: transparent !important;
}
:deep(.v-select .v-chip .v-chip__underlay),
:deep(.v-select .v-chip--selected .v-chip__underlay) {
  background-color: var(--app-accent-weak) !important;
}
:deep(.v-select .v-chip .v-icon),
:deep(.v-select .v-chip--selected .v-icon) {
  color: #000 !important;
}
:deep(.v-select .v-chip .v-chip__content),
:deep(.v-select .v-chip--selected .v-chip__content) {
  color: #000 !important;
}

/* Quick-links chips below: same readable palette */
:deep(.selected-team-chip) {
  background-color: var(--app-accent-weak) !important;
  color: #000 !important;
  border-color: var(--app-accent-weak) !important;
}
:deep(.selected-team-chip .v-chip__overlay) {
  background: transparent !important;
}
:deep(.selected-team-chip .v-chip__underlay) {
  background-color: var(--app-accent-weak) !important;
}
:deep(.selected-team-chip .v-icon) {
  color: #000 !important;
}
:deep(.selected-team-chip .v-chip__content) {
  color: #000 !important;
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
</style>
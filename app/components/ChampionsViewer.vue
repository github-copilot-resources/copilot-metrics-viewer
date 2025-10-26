<template>
  <div>
    <!-- Top 5 Teams Section -->
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card class="mb-4 top-champions-card">
            <v-card-title class="text-h5 d-flex align-center">
              <v-icon size="32" color="amber" class="mr-2">mdi-trophy</v-icon>
              Top 5 Teams by Acceptance Rate
            </v-card-title>
            <v-card-subtitle>
              Teams with the highest average acceptance rate {{ dateRangeDescription }}
            </v-card-subtitle>
            <v-card-text>
              <v-row v-if="topTeams.length > 0">
                <v-col
                  v-for="(team, index) in topTeams"
                  :key="team.uniqueId"
                  cols="12"
                  sm="6"
                  md="4"
                  lg="2"
                >
                  <v-card
                    :class="['champion-card', `champion-rank-${index + 1}`]"
                    elevation="3"
                  >
                    <v-card-text class="text-center">
                      <div class="rank-badge">
                        <v-icon
                          v-if="index === 0"
                          size="48"
                          color="amber-darken-2"
                        >
                          mdi-trophy
                        </v-icon>
                        <v-icon
                          v-else-if="index === 1"
                          size="40"
                          color="grey-lighten-1"
                        >
                          mdi-medal
                        </v-icon>
                        <v-icon
                          v-else-if="index === 2"
                          size="36"
                          color="orange-darken-3"
                        >
                          mdi-medal
                        </v-icon>
                        <span v-else class="rank-number">#{{ index + 1 }}</span>
                      </div>
                      <h3 class="text-h6 mt-2 mb-1 team-name">{{ team.displayName }}</h3>
                      <div class="acceptance-rate">
                        <span class="rate-value">{{ team.acceptanceRate.toFixed(1) }}%</span>
                      </div>
                      <v-divider class="my-2" />
                      <div class="team-stats">
                        <div class="stat-item">
                          <v-icon size="16" class="mr-1">mdi-account-group</v-icon>
                          <span class="text-caption">{{ team.avgActiveUsers }} users</span>
                        </div>
                      </div>
                      <v-btn
                        :href="getTeamDetailUrl(team)"
                        target="_blank"
                        variant="text"
                        size="small"
                        color="primary"
                        class="mt-2"
                      >
                        View Details
                        <v-icon end size="16">mdi-open-in-new</v-icon>
                      </v-btn>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
              <v-alert
                v-else
                type="info"
                variant="tonal"
                class="mt-4"
              >
                No team data available for the selected date range
              </v-alert>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

    <!-- All Teams Table -->
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="text-h5">All Teams Leaderboard</v-card-title>
            <v-card-subtitle>
              Complete ranking of all teams by acceptance rate
            </v-card-subtitle>
            <v-card-text>
              <!-- Search Filter -->
              <v-text-field
                v-model="searchQuery"
                label="Filter by team name"
                prepend-inner-icon="mdi-magnify"
                variant="outlined"
                density="compact"
                clearable
                class="mb-4"
                hide-details
              />

              <!-- Data Table -->
              <v-data-table
                :headers="tableHeaders"
                :items="filteredTeams"
                :search="searchQuery"
                :items-per-page="10"
                :loading="isLoading"
                class="elevation-1"
              >
                <template #item.rank="{ item }">
                  <div class="d-flex align-center">
                    <v-icon
                      v-if="item.rank === 1"
                      color="amber-darken-2"
                      class="mr-1"
                    >
                      mdi-trophy
                    </v-icon>
                    <v-icon
                      v-else-if="item.rank === 2"
                      color="grey-lighten-1"
                      class="mr-1"
                    >
                      mdi-medal
                    </v-icon>
                    <v-icon
                      v-else-if="item.rank === 3"
                      color="orange-darken-3"
                      class="mr-1"
                    >
                      mdi-medal
                    </v-icon>
                    <span class="font-weight-bold">{{ item.rank }}</span>
                  </div>
                </template>

                <template #item.displayName="{ item }">
                  <div class="team-name-cell">
                    <div class="font-weight-medium">{{ item.displayName }}</div>
                    <div v-if="item.description" class="text-caption text-medium-emphasis">
                      {{ item.description }}
                    </div>
                  </div>
                </template>

                <template #item.acceptanceRate="{ item }">
                  <v-chip
                    :color="getAcceptanceRateColor(item.acceptanceRate)"
                    variant="flat"
                    size="small"
                  >
                    {{ item.acceptanceRate.toFixed(1) }}%
                  </v-chip>
                </template>

                <template #item.totalSuggestions="{ item }">
                  <div class="d-flex align-center justify-center">
                    <v-icon size="16" class="mr-1">mdi-code-braces</v-icon>
                    {{ item.totalSuggestions.toLocaleString() }}
                  </div>
                </template>

                <template #item.totalAcceptances="{ item }">
                  <div class="d-flex align-center justify-center">
                    <v-icon size="16" class="mr-1">mdi-check-circle</v-icon>
                    {{ item.totalAcceptances.toLocaleString() }}
                  </div>
                </template>

                <template #item.avgActiveUsers="{ item }">
                  <div class="d-flex align-center justify-center">
                    <v-icon size="16" class="mr-1">mdi-account-group</v-icon>
                    {{ item.avgActiveUsers }}
                  </div>
                </template>

                <template #item.actions="{ item }">
                  <v-btn
                    :href="getTeamDetailUrl(item)"
                    target="_blank"
                    variant="text"
                    size="small"
                    color="primary"
                  >
                    Details
                    <v-icon end size="16">mdi-open-in-new</v-icon>
                  </v-btn>
                </template>

                <template #no-data>
                  <v-alert type="info" variant="tonal" class="ma-4">
                    No teams found. Adjust your filters or check your date range.
                  </v-alert>
                </template>
              </v-data-table>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, onMounted, watch, type PropType } from 'vue'
import { Options } from '@/model/Options'
import type { MetricsApiResponse } from '@/types/metricsApiResponse'
import type { Metrics } from '@/model/Metrics'

interface DateRange {
  since?: string
  until?: string
}

interface Team {
  name: string
  slug: string
  description?: string
  organization?: string
  uniqueId?: string
  displayName?: string
}

interface TeamWithMetrics extends Team {
  acceptanceRate: number
  avgActiveUsers: number
  totalSuggestions: number
  totalAcceptances: number
  rank: number
}

export default defineComponent({
  name: 'ChampionsViewer',
  props: {
    dateRange: {
      type: Object as PropType<DateRange>,
      required: false,
      default: () => ({})
    },
    dateRangeDescription: {
      type: String,
      default: 'Over the last 28 days'
    }
  },
  setup(props) {
    const availableTeams = ref<Team[]>([])
    const teamsWithMetrics = ref<TeamWithMetrics[]>([])
    const isLoading = ref(false)
    const searchQuery = ref('')

    const tableHeaders = [
      { title: 'Rank', key: 'rank', sortable: true, width: '100px' },
      { title: 'Team Name', key: 'displayName', sortable: true },
      { title: 'Acceptance Rate', key: 'acceptanceRate', sortable: true, align: 'center' },
      { title: 'Total Suggestions', key: 'totalSuggestions', sortable: true, align: 'center' },
      { title: 'Total Acceptances', key: 'totalAcceptances', sortable: true, align: 'center' },
      { title: 'Avg Active Users', key: 'avgActiveUsers', sortable: true, align: 'center' },
      { title: 'Actions', key: 'actions', sortable: false, align: 'center' }
    ]

    const topTeams = computed(() => {
      return teamsWithMetrics.value.slice(0, 5)
    })

    const filteredTeams = computed(() => {
      if (!searchQuery.value) {
        return teamsWithMetrics.value
      }
      const query = searchQuery.value.toLowerCase()
      return teamsWithMetrics.value.filter(team =>
        team.displayName?.toLowerCase().includes(query) ||
        team.name.toLowerCase().includes(query) ||
        team.description?.toLowerCase().includes(query)
      )
    })

    const getAcceptanceRateColor = (rate: number): string => {
      if (rate >= 80) return 'success'
      if (rate >= 60) return 'info'
      if (rate >= 40) return 'warning'
      return 'error'
    }

    const getTeamDetailUrl = (team: Team | TeamWithMetrics) => {
      const config = useRuntimeConfig()
      const org = team.organization || config.public.githubOrg
      const ent = config.public.githubEnt

      if (config.public.scope === 'enterprise' || config.public.scope === 'team-enterprise') {
        return `/enterprises/${ent}/teams/${team.slug}`
      }
      return `/orgs/${org}/teams/${team.slug}`
    }

    const loadTeams = async () => {
      const route = useRoute()
      const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until)
      const params = options.toParams()

      const teams = await $fetch<Team[]>('/api/teams', { params })

      const config = useRuntimeConfig()
      const isMultiOrg = config.public.scope === 'multi-organization'

      availableTeams.value = teams.map(team => ({
        ...team,
        uniqueId: team.organization ? `${team.organization}/${team.slug}` : team.slug,
        displayName: team.organization && isMultiOrg ? `${team.name} (${team.organization})` : team.name
      }))
    }

    const loadMetricsForTeam = async (team: Team): Promise<{ acceptanceRate: number; avgActiveUsers: number; totalSuggestions: number; totalAcceptances: number }> => {
      const route = useRoute()
      const options = Options.fromRoute(route, props.dateRange.since, props.dateRange.until)

      // Force scope to team variant based on current broader scope
      if (options.scope === 'enterprise') {
        options.scope = 'team-enterprise'
      } else if (options.scope === 'organization' || options.scope === 'multi-organization') {
        options.scope = 'team-organization'
        if (team.organization) {
          options.githubOrg = team.organization
        } else if (options.githubOrgs && options.githubOrgs.length > 0) {
          options.githubOrg = options.githubOrgs[0]
        }
      }

      options.githubTeam = team.slug
      const params = options.toParams()

      try {
        const response = await $fetch<MetricsApiResponse>('/api/metrics', { params })
        const metrics = (response.metrics as Metrics[]) || []

        if (metrics.length === 0) {
          return { acceptanceRate: 0, avgActiveUsers: 0, totalSuggestions: 0, totalAcceptances: 0 }
        }

        // Calculate acceptance rate using cumulative totals (same method as MetricsViewer)
        const totalSuggestions = metrics.reduce((sum, m) => sum + (m.total_suggestions_count || 0), 0)
        const totalAcceptances = metrics.reduce((sum, m) => sum + (m.total_acceptances_count || 0), 0)
        
        const acceptanceRate = totalSuggestions > 0
          ? (totalAcceptances / totalSuggestions) * 100
          : 0

        // Calculate average active users excluding weekends
        const weekdayUsers = metrics
          .filter(m => {
            const dayOfWeek = new Date(m.day).getDay()
            return dayOfWeek !== 5 && dayOfWeek !== 6 // Exclude Friday and Saturday
          })
          .map(m => m.total_active_users || 0)

        const avgActiveUsers = weekdayUsers.length > 0
          ? Math.round(weekdayUsers.reduce((sum, users) => sum + users, 0) / weekdayUsers.length)
          : 0

        return { acceptanceRate, avgActiveUsers, totalSuggestions, totalAcceptances }
      } catch (error) {
        console.error(`Error loading metrics for team ${team.slug}:`, error)
        return { acceptanceRate: 0, avgActiveUsers: 0, totalSuggestions: 0, totalAcceptances: 0 }
      }
    }

    const loadAllTeamsMetrics = async () => {
      isLoading.value = true
      try {
        await loadTeams()

        const teamsData = await Promise.all(
          availableTeams.value.map(async team => {
            const { acceptanceRate, avgActiveUsers, totalSuggestions, totalAcceptances } = await loadMetricsForTeam(team)
            return {
              ...team,
              acceptanceRate,
              avgActiveUsers,
              totalSuggestions,
              totalAcceptances,
              rank: 0 // Will be set after sorting
            }
          })
        )

        // Sort by acceptance rate descending and assign ranks
        teamsData.sort((a, b) => b.acceptanceRate - a.acceptanceRate)
        teamsData.forEach((team, index) => {
          team.rank = index + 1
        })

        teamsWithMetrics.value = teamsData
      } catch (error) {
        console.error('Error loading teams metrics:', error)
      } finally {
        isLoading.value = false
      }
    }

    onMounted(async () => {
      await loadAllTeamsMetrics()
    })

    watch(() => props.dateRange, async () => {
      await loadAllTeamsMetrics()
    }, { deep: true })

    return {
      topTeams,
      teamsWithMetrics,
      filteredTeams,
      searchQuery,
      tableHeaders,
      isLoading,
      getAcceptanceRateColor,
      getTeamDetailUrl
    }
  }
})
</script>

<style scoped>
.top-champions-card {
  background: linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%);
}

.champion-card {
  transition: transform 0.2s, box-shadow 0.2s;
}

.champion-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15) !important;
}

.champion-rank-1 {
  border-top: 4px solid #ffa000;
}

.champion-rank-2 {
  border-top: 4px solid #bdbdbd;
}

.champion-rank-3 {
  border-top: 4px solid #d84315;
}

.rank-badge {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rank-number {
  font-size: 32px;
  font-weight: bold;
  color: #757575;
}

.team-name {
  min-height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.acceptance-rate {
  margin: 8px 0;
}

.rate-value {
  font-size: 28px;
  font-weight: bold;
  color: #1976d2;
}

.team-stats {
  display: flex;
  justify-content: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  align-items: center;
}

.team-name-cell {
  max-width: 300px;
}

:deep(.v-data-table) {
  border-radius: 4px;
}

:deep(.v-data-table__th) {
  font-weight: 600 !important;
  background-color: #f5f5f5;
}

:deep(.v-data-table__tr:hover) {
  background-color: #fafafa !important;
}
</style>

<template>
  <div>
    <v-container>
      <v-row>
        <v-col cols="12">
          <v-card>
            <v-card-title class="text-h5">
              Teams Comparison
            </v-card-title>
            <v-card-subtitle>
              Compare metrics across multiple teams in your {{ scopeType }}
            </v-card-subtitle>
            <v-card-text>
              <v-row>
                <v-col cols="12" md="6">
                  <v-card class="pa-4">
                    <v-card-title class="text-h6">Acceptance Rate Comparison</v-card-title>
                    <v-card-text>
                      <div class="text-body-2 text-medium-emphasis mb-4">
                        {{ dateRangeDescription }}
                      </div>
                      <div v-if="teams.length === 0" class="text-center text-medium-emphasis">
                        No team data available for comparison
                      </div>
                      <div v-else>
                        <v-table>
                          <thead>
                            <tr>
                              <th>Team</th>
                              <th>Acceptance Rate</th>
                              <th>Total Suggestions</th>
                              <th>Total Acceptances</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="team in teams" :key="team.name">
                              <td>{{ team.name }}</td>
                              <td>{{ team.acceptance_rate }}%</td>
                              <td>{{ team.total_suggestions }}</td>
                              <td>{{ team.total_acceptances }}</td>
                            </tr>
                          </tbody>
                        </v-table>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card class="pa-4">
                    <v-card-title class="text-h6">Language Usage Comparison</v-card-title>
                    <v-card-text>
                      <div class="text-body-2 text-medium-emphasis mb-4">
                        Top languages by acceptance rate across teams
                      </div>
                      <div v-if="languageComparison.length === 0" class="text-center text-medium-emphasis">
                        No language data available for comparison
                      </div>
                      <div v-else>
                        <v-table>
                          <thead>
                            <tr>
                              <th>Language</th>
                              <th>Teams Using</th>
                              <th>Avg Acceptance Rate</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="lang in languageComparison" :key="lang.name">
                              <td>{{ lang.name }}</td>
                              <td>{{ lang.teams_count }}</td>
                              <td>{{ lang.avg_acceptance_rate }}%</td>
                            </tr>
                          </tbody>
                        </v-table>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
              <v-row>
                <v-col cols="12" md="6">
                  <v-card class="pa-4">
                    <v-card-title class="text-h6">Editor Usage Comparison</v-card-title>
                    <v-card-text>
                      <div class="text-body-2 text-medium-emphasis mb-4">
                        Editor distribution across teams
                      </div>
                      <div v-if="editorComparison.length === 0" class="text-center text-medium-emphasis">
                        No editor data available for comparison
                      </div>
                      <div v-else>
                        <v-table>
                          <thead>
                            <tr>
                              <th>Editor</th>
                              <th>Teams Using</th>
                              <th>Avg Users</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="editor in editorComparison" :key="editor.name">
                              <td>{{ editor.name }}</td>
                              <td>{{ editor.teams_count }}</td>
                              <td>{{ editor.avg_users }}</td>
                            </tr>
                          </tbody>
                        </v-table>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
                <v-col cols="12" md="6">
                  <v-card class="pa-4">
                    <v-card-title class="text-h6">Feature Usage Over Time</v-card-title>
                    <v-card-text>
                      <div class="text-body-2 text-medium-emphasis mb-4">
                        IDE completions, Chat, and PR features
                      </div>
                      <div v-if="featureUsage.length === 0" class="text-center text-medium-emphasis">
                        No feature usage data available for comparison
                      </div>
                      <div v-else>
                        <v-table>
                          <thead>
                            <tr>
                              <th>Feature</th>
                              <th>Avg Daily Usage</th>
                              <th>Teams Active</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr v-for="feature in featureUsage" :key="feature.name">
                              <td>{{ feature.name }}</td>
                              <td>{{ feature.avg_daily_usage }}</td>
                              <td>{{ feature.teams_active }}</td>
                            </tr>
                          </tbody>
                        </v-table>
                      </div>
                    </v-card-text>
                  </v-card>
                </v-col>
              </v-row>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </v-container>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Props {
  dateRangeDescription: string
}

const props = defineProps<Props>()

interface TeamData {
  name: string
  acceptance_rate: number
  total_suggestions: number
  total_acceptances: number
}

interface LanguageComparison {
  name: string
  teams_count: number
  avg_acceptance_rate: number
}

interface EditorComparison {
  name: string
  teams_count: number
  avg_users: number
}

interface FeatureUsage {
  name: string
  avg_daily_usage: number
  teams_active: number
}

// Mock data for now - would be replaced with actual API calls
const teams = ref<TeamData[]>([
  { name: 'the-a-team', acceptance_rate: 78.5, total_suggestions: 2450, total_acceptances: 1923 },
  { name: 'dev-team', acceptance_rate: 82.3, total_suggestions: 1890, total_acceptances: 1555 },
  { name: 'frontend-team', acceptance_rate: 75.1, total_suggestions: 3200, total_acceptances: 2403 }
])

const languageComparison = ref<LanguageComparison[]>([
  { name: 'TypeScript', teams_count: 3, avg_acceptance_rate: 80.2 },
  { name: 'JavaScript', teams_count: 2, avg_acceptance_rate: 76.8 },
  { name: 'Python', teams_count: 2, avg_acceptance_rate: 84.1 },
  { name: 'Java', teams_count: 1, avg_acceptance_rate: 72.5 }
])

const editorComparison = ref<EditorComparison[]>([
  { name: 'VS Code', teams_count: 3, avg_users: 12 },
  { name: 'IntelliJ', teams_count: 2, avg_users: 8 },
  { name: 'WebStorm', teams_count: 1, avg_users: 5 }
])

const featureUsage = ref<FeatureUsage[]>([
  { name: 'IDE Code Completions', avg_daily_usage: 156, teams_active: 3 },
  { name: 'IDE Chat', avg_daily_usage: 45, teams_active: 3 },
  { name: 'GitHub.com Chat', avg_daily_usage: 23, teams_active: 2 },
  { name: 'GitHub.com PR', avg_daily_usage: 12, teams_active: 2 }
])

const scopeType = computed(() => {
  // This would be determined by the actual scope configuration
  return 'organization'
})
</script>
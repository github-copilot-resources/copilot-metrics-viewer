<template>
  <div>
    <v-toolbar color="indigo" elevation="4">
      <v-btn icon>
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title class="toolbar-title">{{ displayName }}</v-toolbar-title>
      <h2 class="error-message"> {{ mockedDataMessage }} </h2>
      <v-spacer />

      <!-- Conditionally render the logout button -->
      <AuthState>
        <template #default="{ loggedIn, user }">
          <div v-show="loggedIn" class="user-info">
            Welcome,
            <v-avatar class="user-avatar">
              <v-img :alt="user?.name" :src="user?.avatarUrl" />
            </v-avatar> {{ user?.name }}
          </div>
          <v-btn v-if="showLogoutButton && loggedIn" class="logout-button" @click="logout">Logout</v-btn>
        </template>
      </AuthState>

      <template #extension>

        <v-tabs v-model="tab" align-tabs="title">
          <v-tab v-for="item in tabItems" :key="item" :value="item">
            {{ item }}
          </v-tab>
        </v-tabs>

      </template>

    </v-toolbar>

    <!-- Date Range Selector - Hidden for seats tab -->
    <DateRangeSelector 
      v-show="tab !== 'seat analysis'"
      :loading="isLoading"
      @date-range-changed="handleDateRangeChange"
    />
    
    <!-- Organization info for seats tab -->
    <div v-if="tab === 'seat analysis'" class="organization-info">
      <v-card flat class="pa-3 mb-2">
        <div class="text-body-2 text-center">
          Displaying data for organization: <strong>{{ displayName }}</strong>
        </div>
      </v-card>
    </div>

    <!-- API Error Message -->
    <div v-show="apiError && !signInRequired" class="error-message" v-text="apiError" />
    <AuthState>
      <template #default="{ loggedIn }">
        <div v-show="signInRequired" class="github-login-container">
          <NuxtLink v-if="!loggedIn && signInRequired" to="/auth/github" external class="github-login-button"> <v-icon
              left>mdi-github</v-icon>
            Sign in with GitHub</NuxtLink>
        </div>
      </template>
      <template #placeholder>
        <button disabled>Loading...</button>
      </template>
    </AuthState>


    <div v-show="!apiError">
      <v-progress-linear v-show="!metricsReady" indeterminate color="indigo" />
      <v-window v-show="(metricsReady && metrics.length) || (seatsReady && tab === 'seat analysis')" v-model="tab">
        <v-window-item v-for="item in tabItems" :key="item" :value="item">
          <v-card flat>
            <MetricsViewer v-if="item === itemName" :metrics="metrics" :date-range-description="dateRangeDescription" />
            <BreakdownComponent v-if="item === 'languages'" :metrics="metrics" :breakdown-key="'language'" :date-range-description="dateRangeDescription" />
            <BreakdownComponent v-if="item === 'editors'" :metrics="metrics" :breakdown-key="'editor'" :date-range-description="dateRangeDescription" />
            <CopilotChatViewer v-if="item === 'copilot chat'" :metrics="metrics" :date-range-description="dateRangeDescription" />
            <SeatsAnalysisViewer v-if="item === 'seat analysis'" :seats="seats" />
            <ApiResponse
v-if="item === 'api response'" :metrics="metrics" :original-metrics="originalMetrics"
              :seats="seats" />
          </v-card>
        </v-window-item>
        <v-alert
v-show="(metricsReady && metrics.length == 0 && tab !== 'seat analysis') || (seatsReady && seats.length == 0 && tab === 'seat analysis')" density="compact" text="No data available to display"
          title="No data" type="warning" />
      </v-window>

    </div>

  </div>
</template>
<script lang='ts'>
import type { Metrics } from '@/model/Metrics';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { MetricsApiResponse } from '@/types/metricsApiResponse';
import type { Seat } from "@/model/Seat";
import type { H3Error } from 'h3'

//Components
import MetricsViewer from './MetricsViewer.vue'
import BreakdownComponent from './BreakdownComponent.vue'
import CopilotChatViewer from './CopilotChatViewer.vue'
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue'
import ApiResponse from './ApiResponse.vue'
import DateRangeSelector from './DateRangeSelector.vue'

export default defineNuxtComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
    BreakdownComponent,
    CopilotChatViewer,
    SeatsAnalysisViewer,
    ApiResponse,
    DateRangeSelector
  },
  methods: {
    logout() {
      const { clear } = useUserSession()
      this.metrics = [];
      this.seats = [];
      // console.log('metrics are now', this.metrics);
      clear();
    },
    async handleDateRangeChange(dateRange: { since?: string; until?: string; description: string }) {
      this.dateRangeDescription = dateRange.description;
      this.isLoading = true;
      
      try {
        // Build query parameters
        const params = new URLSearchParams();
        if (dateRange.since) params.append('since', dateRange.since);
        if (dateRange.until) params.append('until', dateRange.until);
        
        const queryString = params.toString();
        const apiUrl = queryString ? `/api/metrics?${queryString}` : '/api/metrics';
        
        const response = await $fetch(apiUrl) as MetricsApiResponse;
        
        this.metrics = response.metrics || [];
        this.originalMetrics = response.usage || [];
        this.metricsReady = true;
        this.apiError = undefined;
      } catch (error: any) {
        this.processError(error);
      } finally {
        this.isLoading = false;
      }
    },
    processError(error: H3Error) {
      console.error(error || 'No data returned from API');
      // Check the status code of the error response
      if (error && error.statusCode) {
        switch (error.statusCode) {
          case 401:
            this.apiError = '401 Unauthorized access returned by GitHub API - check if your token in the .env (for local runs). Check PAT token and GitHub permissions.';
            break;
          case 404:
            this.apiError = `404 Not Found - is the ${this.config?.public?.scope || ''} org:"${this.config?.public?.githubOrg || ''}" ent:"${this.config?.public?.githubEnt || ''}" team:"${this.config?.public?.githubTeam}" correct? ${error.message}`;
            break;
          case 422:
            this.apiError = `422 Unprocessable Entity - Is the Copilot Metrics API enabled for the Org/Ent? ${error.message}`;
            break;
          case 500:
            this.apiError = `500 Internal Server Error - most likely a bug in the app. Error: ${error.message}`;
            break;
          default:
            this.apiError = `${error.statusCode} Error: ${error.message}`;
            break;
        }
      }
    }
  },

  data() {
    return {
      tabItems: ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response'],
      tab: null,
      dateRangeDescription: 'Over the last 28 days',
      isLoading: false,
      metricsReady: false,
      metrics: [] as Metrics[],
      originalMetrics: [] as CopilotMetrics[],
      seatsReady: false,
      seats: [] as Seat[],
      apiError: undefined as string | undefined,
      config: null as any
    }
  },
  created() {
    this.tabItems.unshift(this.itemName);
    this.config = useRuntimeConfig();
  },
  async mounted() {
    // Load initial data
    try {
      const { data: metricsData, error: metricsError } = await this.metricsFetch;
      if (metricsError.value || !metricsData.value) {
        this.processError(metricsError.value as H3Error);
      } else {
        const apiResponse = metricsData.value as MetricsApiResponse;
        this.metrics = apiResponse.metrics || [];
        this.originalMetrics = apiResponse.usage || [];
        this.metricsReady = true;
      }

      if (this.config.public.scope === 'team' && this.metrics.length === 0 && !this.apiError) {
        this.apiError = 'No data returned from API - check if the team exists and has any activity and at least 5 active members';
      }

      const { data: seatsData, error: seatsError } = await this.seatsFetch;
      if (seatsError.value) {
        this.processError(seatsError.value as H3Error);
      } else {
        this.seats = seatsData.value || [];
        this.seatsReady = true;
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  },
  async setup() {
    const { loggedIn, user } = useUserSession()
    const config = useRuntimeConfig();
    const showLogoutButton = computed(() => config.public.usingGithubAuth && loggedIn.value);
    const mockedDataMessage = computed(() => config.public.isDataMocked ? 'Using mock data - see README if unintended' : '');
    const itemName = computed(() => config.public.scope);
    const githubInfo = getDisplayName(config.public)
    const displayName = computed(() => githubInfo);

    const signInRequired = computed(() => {
      return config.public.usingGithubAuth && !loggedIn.value;
    });

    // Initial data load with default date range
    const metricsFetch = useFetch('/api/metrics', { 
      key: 'initial-metrics',
      server: true
    });
    const seatsFetch = useFetch('/api/seats', { 
      key: 'initial-seats',
      server: true
    });

    return {
      showLogoutButton,
      mockedDataMessage,
      itemName,
      displayName,
      signInRequired,
      user,
      metricsFetch,
      seatsFetch
    };
  },
})
</script>

<style scoped>
.toolbar-title {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;

}

.error-message {
  color: red;
}

.logout-button {
  margin-left: auto;
}

.github-login-container {
  display: flex;
  justify-content: center;
  margin-top: 20px;
}

.github-login-button {
  display: flex;
  align-items: center;
  background-color: #24292e;
  color: white;
  padding: 10px 20px;
  border-radius: 5px;
  text-decoration: none;
  font-weight: bold;
  font-size: 14px;
}

.github-login-button:hover {
  background-color: #444d56;
}

.github-login-button v-icon {
  margin-right: 8px;
}

.user-info {
  display: flex;
  align-items: center;
}

.user-avatar {
  margin-right: 8px;
  margin-left: 8px;
  border: 2px solid white;
}

.organization-info {
  background-color: #f5f5f5;
  border-left: 4px solid #1976d2;
}
</style>
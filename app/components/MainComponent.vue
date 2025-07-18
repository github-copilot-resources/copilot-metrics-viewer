<template>
  <div>
    <v-app-bar color="primary" elevation="2" class="app-header">
      <v-app-bar-nav-icon @click="drawer = !drawer" class="d-md-none"></v-app-bar-nav-icon>
      
      <v-btn icon class="mr-2">
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-app-bar-title class="toolbar-title font-weight-bold">{{ displayName }}</v-app-bar-title>
      <span v-if="mockedDataMessage" class="error-message text-caption px-2 py-1 rounded">{{ mockedDataMessage }}</span>
      <v-spacer />

      <!-- Conditionally render the logout button -->
      <AuthState>
        <template #default="{ loggedIn, user }">
          <div v-show="loggedIn" class="user-info d-none d-sm-flex">
            <span class="mr-2">Welcome,</span>
            <v-avatar size="32" class="user-avatar">
              <v-img :alt="user?.name" :src="user?.avatarUrl" />
            </v-avatar> 
            <span class="ml-2 font-weight-medium">{{ user?.name }}</span>
          </div>
          <v-btn 
            v-if="showLogoutButton && loggedIn" 
            class="logout-button ml-4" 
            @click="logout" 
            prepend-icon="mdi-logout"
            variant="tonal"
            color="primary"
          >
            Logout
          </v-btn>
        </template>
      </AuthState>

      <v-btn icon class="ml-2" @click="toggleTheme">
        <v-icon>{{ isDarkTheme ? 'mdi-weather-sunny' : 'mdi-weather-night' }}</v-icon>
      </v-btn>

      <template #extension>
        <v-tabs 
          v-model="tab" 
          align-tabs="center"
          slider-color="white"
          bg-color="primary"
          class="d-none d-md-flex"
        >
          <v-tab 
            v-for="item in tabItems" 
            :key="item" 
            :value="item"
            class="text-white text-capitalize"
          >
            {{ item }}
          </v-tab>
        </v-tabs>
      </template>
    </v-app-bar>
    
    <!-- Navigation drawer for mobile -->
    <v-navigation-drawer
      v-model="drawer"
      temporary
      class="d-md-none"
    >
      <v-list>
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Copilot Metrics"
          :subtitle="displayName"
        ></v-list-item>
        <v-divider></v-divider>
        <v-list-item
          v-for="item in tabItems"
          :key="item"
          :value="item"
          @click="tab = item; drawer = false"
          :active="tab === item"
          :title="item"
          class="text-capitalize"
        ></v-list-item>
      </v-list>
    </v-navigation-drawer>

    <!-- Date Range Selector - Hidden for seats tab -->
    <DateRangeSelector 
      v-show="tab !== 'seat analysis' && !signInRequired" 
      :loading="isLoading"
      @date-range-changed="handleDateRangeChange" />

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


    <div v-show="!apiError" class="content-container pa-4">
      <v-progress-linear v-show="!metricsReady" indeterminate color="primary" />
      
      <v-window v-show="(metricsReady && metrics.length) || (seatsReady && tab === 'seat analysis')" v-model="tab">
        <v-window-item v-for="item in tabItems" :key="item" :value="item">
          <v-card class="pa-4 rounded-lg elevation-1">
            <v-card-title class="text-h5 font-weight-bold pb-4 text-primary text-capitalize">
              {{ item }}
              <v-chip size="small" color="primary" class="ml-2 text-white">{{ dateRangeDescription }}</v-chip>
            </v-card-title>
            
            <v-card-text>
              <MetricsViewer v-if="item === itemName" :metrics="metrics" :date-range-description="dateRangeDescription" />
              <BreakdownComponent
                v-if="item === 'languages'" 
                :metrics="metrics" 
                :breakdown-key="'language'"
                :date-range-description="dateRangeDescription" 
              />
              <BreakdownComponent
                v-if="item === 'editors'" 
                :metrics="metrics" 
                :breakdown-key="'editor'"
                :date-range-description="dateRangeDescription" 
              />
              <CopilotChatViewer
                v-if="item === 'copilot chat'" 
                :metrics="metrics"
                :date-range-description="dateRangeDescription" 
              />
              <AgentModeViewer 
                v-if="item === 'github.com'" 
                :original-metrics="originalMetrics" 
                :date-range="dateRange" 
                :date-range-description="dateRangeDescription" 
              />
              <SeatsAnalysisViewer 
                v-if="item === 'seat analysis'" 
                :seats="seats" 
              />
              <ApiResponse
                v-if="item === 'api response'" 
                :metrics="metrics" 
                :original-metrics="originalMetrics"
                :seats="seats" 
              />
            </v-card-text>
          </v-card>
        </v-window-item>
        
        <v-alert
          v-show="(metricsReady && metrics.length == 0 && tab !== 'seat analysis') || (seatsReady && seats.length == 0 && tab === 'seat analysis')"
          density="compact" 
          text="No data available to display" 
          title="No data" 
          type="warning"
          class="mt-4" 
        />
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
import AgentModeViewer from './AgentModeViewer.vue'
import DateRangeSelector from './DateRangeSelector.vue'
import { Options } from '@/model/Options';
import { useRoute } from 'vue-router';

export default defineNuxtComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
    BreakdownComponent,
    CopilotChatViewer,
    SeatsAnalysisViewer,
    ApiResponse,
    AgentModeViewer,
    DateRangeSelector
  },
  methods: {
    toggleTheme() {
      this.isDarkTheme = !this.isDarkTheme;
      this.$vuetify.theme.global.name = this.isDarkTheme ? 'dark' : 'light';
    },
    logout() {
      const { clear } = useUserSession()
      this.metrics = [];
      this.seats = [];
      clear();
    },
    async handleDateRangeChange(newDateRange: { 
      since?: string; 
      until?: string; 
      description: string;
      excludeHolidays?: boolean;
    }) {
      this.dateRangeDescription = newDateRange.description;
      this.dateRange = {
        since: newDateRange.since,
        until: newDateRange.until
      };

      // Store holiday options
      this.holidayOptions = {
        excludeHolidays: newDateRange.excludeHolidays,
      };

      await this.fetchMetrics();
    },
    async fetchMetrics() {
      if (this.signInRequired || !this.dateRange.since || !this.dateRange.until || this.isLoading) {
        return;
      }
      const config = useRuntimeConfig();

      this.isLoading = true;

      try {
        const options = Options.fromRoute(this.route, this.dateRange.since, this.dateRange.until);
        
        // Add holiday options if they're set
        if (this.holidayOptions?.excludeHolidays) {
          options.excludeHolidays = this.holidayOptions.excludeHolidays;
        }
        
        const params = options.toParams();

        const queryString = new URLSearchParams(params).toString();
        const apiUrl = queryString ? `/api/metrics?${queryString}` : '/api/metrics';

        const response = await $fetch(apiUrl) as MetricsApiResponse;

        this.metrics = response.metrics || [];
        this.originalMetrics = response.usage || [];
        this.metricsReady = true;

        if (config.public.scope && config.public.scope.includes('team') && this.metrics.length === 0 && !this.apiError) {
          this.apiError = 'No data returned from API - check if the team exists and has any activity and at least 5 active members';
        }

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
      tabItems: ['languages', 'editors', 'copilot chat', 'github.com', 'seat analysis', 'api response'],
      tab: null,
      dateRangeDescription: 'Over the last 28 days',
      isLoading: false,
      metricsReady: false,
      metrics: [] as Metrics[],
      originalMetrics: [] as CopilotMetrics[],
      seatsReady: false,
      seats: [] as Seat[],
      apiError: undefined as string | undefined,
      config: null as ReturnType<typeof useRuntimeConfig> | null,
      holidayOptions: {
        excludeHolidays: false,
      },
      drawer: false,
      isDarkTheme: false
    }
  },
  
  created() {
    this.tabItems.unshift(this.itemName);
    this.config = useRuntimeConfig();
  },
  async mounted() {
    // Load initial data
    try {

      await this.fetchMetrics();

      const { data: seatsData, error: seatsError, execute: executeSeats } = this.seatsFetch;

      if (!this.signInRequired) {
        await executeSeats();

        if (seatsError.value) {
          this.processError(seatsError.value as H3Error);
        } else {
          this.seats = (seatsData.value as Seat[]) || [];
          this.seatsReady = true;
        }
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
    const dateRange = ref({ since: undefined as string | undefined, until: undefined as string | undefined });
    const isLoading = ref(false);
    const route = ref(useRoute());

    const signInRequired = computed(() => {
      return config.public.usingGithubAuth && !loggedIn.value;
    });

    const seatsFetch = useFetch('/api/seats', {
      server: true,
      immediate: !signInRequired.value,
      query: computed(() => {
        const options = Options.fromRoute(route.value);
        return options.toParams();
      })
    });

    return {
      showLogoutButton,
      mockedDataMessage,
      itemName,
      displayName,
      signInRequired,
      user,
      seatsFetch,
      dateRange,
      isLoading,
      route,
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
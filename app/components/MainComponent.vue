<template>
  <div>
    <!-- Modern App Bar with responsive design -->
    <v-app-bar color="primary" elevation="2" class="app-header">
      <v-app-bar-nav-icon @click="drawer = !drawer" class="d-md-none text-white"></v-app-bar-nav-icon>
      
      <v-btn icon class="mr-2 text-white">
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-app-bar-title class="toolbar-title text-white">{{ displayName }}</v-app-bar-title>
      <span v-if="mockedDataMessage" class="error-message text-caption px-2 py-1 rounded">{{ mockedDataMessage }}</span>
      <v-spacer />

      <!-- Conditionally render the user info and logout button -->
      <AuthState>
        <template #default="{ loggedIn, user }">
          <div v-show="loggedIn" class="user-info d-none d-sm-flex">
            <span class="mr-2 text-white">Welcome,</span>
            <v-avatar size="32" class="user-avatar">
              <v-img :alt="user?.name" :src="user?.avatarUrl" />
            </v-avatar> 
            <span class="ml-2 font-weight-medium text-white">{{ user?.name }}</span>
          </div>
          <v-btn 
            v-if="showLogoutButton && loggedIn" 
            class="logout-button ml-4" 
            @click="logout" 
            prepend-icon="mdi-logout"
            variant="tonal"
            color="white"
          >
            Logout
          </v-btn>
        </template>
      </AuthState>

      <ThemeToggle 
        class="ml-2" 
        :is-dark-theme="isDarkTheme" 
        @toggle="toggleTheme" 
      />

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

    <!-- Main Content Container -->
    <div class="content-container">
      <!-- Welcome Banner -->
      <WelcomeBanner 
        v-if="!signInRequired" 
        :user-name="user?.name"
        :org-name="displayName"
        :is-dark-theme="isDarkTheme"
      />
      
      <!-- Date Range Selector - Hidden for seats tab -->
      <DateRangeSelector 
        v-show="tab !== 'seat analysis' && !signInRequired" 
        :loading="isLoading"
        @date-range-changed="handleDateRangeChange"
        class="date-range-selector pa-4 mb-6" 
      />

      <!-- Organization info for seats tab -->
      <div v-if="tab === 'seat analysis'" class="organization-info">
        <v-card flat class="pa-4 mb-4">
          <div class="d-flex align-center">
            <v-icon color="primary" class="mr-2">mdi-office-building</v-icon>
            <div>
              <div class="text-body-1 font-weight-medium">Organization</div>
              <div class="text-body-2 font-weight-bold">{{ displayName }}</div>
            </div>
          </div>
        </v-card>
      </div>

      <!-- API Error Message -->
      <v-alert
        v-show="apiError && !signInRequired"
        type="error"
        variant="tonal"
        class="mb-4"
        :text="apiError"
        closable
      />

      <!-- GitHub Login -->
      <AuthState>
        <template #default="{ loggedIn }">
          <div v-show="signInRequired" class="github-login-container">
            <NuxtLink v-if="!loggedIn && signInRequired" to="/auth/github" external class="github-login-button">
              <v-icon class="mr-2">mdi-github</v-icon>
              Sign in with GitHub
            </NuxtLink>
          </div>
        </template>
        <template #placeholder>
          <div class="d-flex justify-center my-8">
            <v-progress-circular indeterminate color="primary"></v-progress-circular>
          </div>
        </template>
      </AuthState>

      <!-- Main Content Area -->
      <div v-show="!apiError">
        <LoadingAnimation v-if="!metricsReady" message="Loading metrics data..." />
        
        <v-window v-show="(metricsReady && metrics.length) || (seatsReady && tab === 'seat analysis')" v-model="tab">
          <v-window-item v-for="item in tabItems" :key="item" :value="item">
            <v-card class="pa-4 rounded-lg">
              <DashboardLayout
                :title="item"
                :icon="getTabIcon(item)"
                :date-range="dateRangeDescription"
                :metrics="metrics"
                :show-metric-cards="item === itemName || item === 'languages' || item === 'editors'"
                :is-dark-theme="isDarkTheme"
              >
                <v-card-text class="pa-0">
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
            density="comfortable" 
            text="No data available to display" 
            title="No data" 
            type="warning"
            variant="tonal"
            class="mt-4" 
            icon="mdi-alert-circle-outline"
          />
        </v-window>
      </div>
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
import WelcomeBanner from './WelcomeBanner.vue'
import StatsSummary from './StatsSummary.vue'
import LoadingAnimation from './LoadingAnimation.vue'
import DashboardLayout from './DashboardLayout.vue'
import MetricCard from './MetricCard.vue'
import ThemeToggle from './ThemeToggle.vue'
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
    DateRangeSelector,
    WelcomeBanner,
    StatsSummary,
    LoadingAnimation,
    DashboardLayout,
    MetricCard,
    ThemeToggle
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
    },
    getTabIcon(tab: string) {
      switch (tab.toLowerCase()) {
        case 'languages':
          return 'mdi-code-tags';
        case 'editors':
          return 'mdi-pencil-box-outline';
        case 'copilot chat':
          return 'mdi-message-text-outline';
        case 'github.com':
          return 'mdi-github';
        case 'seat analysis':
          return 'mdi-account-group-outline';
        case 'api response':
          return 'mdi-api';
        case 'organization':
        case 'enterprise':
        case 'team-organization':
        case 'team-enterprise':
          return 'mdi-chart-bar';
        default:
          return 'mdi-view-dashboard-outline';
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
    // Check system preference for dark mode
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (prefersDark) {
      this.isDarkTheme = true;
      this.$vuetify.theme.global.name = 'dark';
    }
    
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
.text-white {
  color: white !important;
}

.app-header {
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.toolbar-title {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  font-weight: 600;
}

.user-info {
  display: flex;
  align-items: center;
  background-color: rgba(255, 255, 255, 0.1);
  padding: 4px 12px;
  border-radius: 24px;
}

.user-avatar {
  margin-right: 8px;
  margin-left: 8px;
  border: 2px solid white;
}

.logout-button {
  margin-left: auto;
}
</style>
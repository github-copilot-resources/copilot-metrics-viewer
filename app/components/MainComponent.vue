<template>
  <div>
    <!-- Modern App Bar with hamburger menu -->
    <v-app-bar 
      :color="isDarkTheme ? 'gradient-dark' : 'gradient-light'" 
      elevation="3" 
      class="app-header"
      height="70"
    >
      <v-app-bar-nav-icon 
        @click="drawer = !drawer" 
        class="hamburger-icon"
        size="large"
      ></v-app-bar-nav-icon>
      
      <div class="d-flex align-center">
        <CopilotLogo />
      </div>
      
      <span v-if="mockedDataMessage" class="error-message text-caption px-2 py-1 rounded">{{ mockedDataMessage }}</span>
      <v-spacer />

      <ThemeToggle 
        class="ml-2" 
        :is-dark-theme="isDarkTheme" 
        @toggle="toggleTheme" 
      />
    </v-app-bar>
    
    <!-- Navigation drawer with hamburger menu -->
    <v-navigation-drawer
      v-model="drawer"
      temporary
      location="left"
      width="280"
      class="navigation-drawer"
    >
      <v-list class="drawer-list">
        <v-list-item
          prepend-icon="mdi-view-dashboard"
          title="Copilot Metrics"
          :subtitle="displayName"
          class="py-4 drawer-header"
        >
          <template v-slot:append>
            <v-btn
              icon
              variant="text"
              @click="drawer = false"
              class="close-btn"
            >
              <v-icon>mdi-close</v-icon>
            </v-btn>
          </template>
        </v-list-item>
        
        <v-divider class="drawer-divider"></v-divider>
        
        <div 
          v-for="item in tabItems"
          :key="item"
          class="custom-menu-item my-1"
          :class="{'custom-menu-item-active': tab === item}"
          @click="tab = item; drawer = false"
        >
          <v-icon class="menu-icon" :icon="getTabIcon(item)"></v-icon>
          <span class="menu-text text-capitalize">{{ item }}</span>
        </div>
        
        <v-divider class="drawer-divider my-3"></v-divider>
        
        <v-list-item
          prepend-icon="mdi-cog-outline"
          title="Settings"
          class="drawer-item my-1"
          rounded="lg"
        >
          <template v-slot:append>
            <v-switch
              v-model="isDarkTheme"
              color="primary"
              hide-details
              inset
              :label="isDarkTheme ? 'Dark' : 'Light'"
              density="compact"
              @change="toggleTheme"
            ></v-switch>
          </template>
        </v-list-item>
        
        <AuthState>
          <template #default="{ loggedIn }">
            <v-list-item
              v-if="loggedIn && showLogoutButton"
              prepend-icon="mdi-logout"
              title="Logout"
              class="drawer-item my-1"
              rounded="lg"
              @click="logout"
            ></v-list-item>
          </template>
        </AuthState>
      </v-list>
      
      <template v-slot:append>
        <div class="pa-4">
          <v-btn
            block
            color="primary"
            href="https://github.com/github-copilot-resources/copilot-metrics-viewer"
            target="_blank"
            prepend-icon="mdi-github"
          >
            View on GitHub
          </v-btn>
        </div>
      </template>
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
                  <MetricsViewer 
                    v-if="item === itemName" 
                    :metrics="metrics" 
                    :date-range-description="dateRangeDescription"
                    :is-dark-theme="isDarkTheme" 
                  />
                  <BreakdownComponent
                    v-if="item === 'languages'" 
                    :metrics="metrics" 
                    :breakdown-key="'language'"
                    :date-range-description="dateRangeDescription"
                    :is-dark-theme="isDarkTheme" 
                  />
                  <BreakdownComponent
                    v-if="item === 'editors'" 
                    :metrics="metrics" 
                    :breakdown-key="'editor'"
                    :date-range-description="dateRangeDescription"
                    :is-dark-theme="isDarkTheme" 
                  />
                  <CopilotChatViewer
                    v-if="item === 'copilot chat'" 
                    :metrics="metrics"
                    :date-range-description="dateRangeDescription"
                    :is-dark-theme="isDarkTheme" 
                  />
                  <AgentModeViewer 
                    v-if="item === 'github.com'" 
                    :original-metrics="originalMetrics" 
                    :date-range="dateRange" 
                    :date-range-description="dateRangeDescription"
                    :is-dark-theme="isDarkTheme" 
                  />
                  <SeatsAnalysisViewer 
                    v-if="item === 'seat analysis'" 
                    :seats="seats"
                    :is-dark-theme="isDarkTheme" 
                  />
                  <ApiResponse
                    v-if="item === 'api response'" 
                    :metrics="metrics" 
                    :original-metrics="originalMetrics"
                    :seats="seats"
                    :is-dark-theme="isDarkTheme" 
                  />
                </v-card-text>
              </DashboardLayout>
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

import LoadingAnimation from './LoadingAnimation.vue'
import DashboardLayout from './DashboardLayout.vue'
import MetricCard from './MetricCard.vue'
import ThemeToggle from './ThemeToggle.vue'
import CopilotLogo from './CopilotLogo.vue'
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

    LoadingAnimation,
    DashboardLayout,
    MetricCard,
    ThemeToggle,
    CopilotLogo
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
  border-bottom: 3px solid rgba(255, 255, 255, 0.2);
  background: v-bind('isDarkTheme ? "linear-gradient(135deg, #64D8CB 0%, #9C64D8 100%)" : "linear-gradient(135deg, #26A69A 0%, #7B1FA2 100%)"') !important;
  box-shadow: v-bind('isDarkTheme ? "0 4px 12px rgba(0, 0, 0, 0.4)" : "0 4px 12px rgba(0, 0, 0, 0.2)"') !important;
  position: relative;
  z-index: 10;
}

.app-header::after {
  content: '';
  position: absolute;
  bottom: -3px;
  left: 0;
  right: 0;
  height: 3px;
  background: v-bind('isDarkTheme ? "linear-gradient(90deg, #8BE9FD, #64D8CB, #9C64D8)" : "linear-gradient(90deg, #4DD0E1, #26A69A, #7B1FA2)"');
  background-size: 200% 100%;
  animation: shimmer 2s infinite;
  z-index: 11;
}

@keyframes shimmer {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

.toolbar-title {
  white-space: nowrap;
  overflow: visible;
  text-overflow: clip;
  font-weight: 600;
}

.hamburger-icon {
  background-color: rgba(255, 255, 255, 0.2);
  border-radius: 8px;
  transition: all 0.3s;
  color: white !important;
  font-weight: bold;
}

.hamburger-icon:hover {
  background-color: rgba(255, 255, 255, 0.3);
}

.header-logo {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.3s;
}

.header-logo:hover {
  transform: scale(1.05);
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

/* Navigation drawer styling */
.navigation-drawer {
  background-color: v-bind('isDarkTheme ? "#1E1E1E" : "#FFFFFF"') !important; /* Solid background color, no transparency */
  border-right: 1px solid rgba(139, 233, 253, 0.2);
}

/* Custom menu item styling */
.custom-menu-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 4px;
  color: v-bind('isDarkTheme ? "#F8F8F2" : "#333333"');
  position: relative;
  background-color: transparent;
}

.custom-menu-item:hover {
  background-color: rgba(100, 216, 203, 0.05);
}

.menu-icon {
  margin-right: 12px;
  color: v-bind('isDarkTheme ? "rgba(139, 233, 253, 0.7)" : "rgba(38, 166, 154, 0.8)"');
}

.menu-text {
  font-size: 0.95rem;
  font-weight: 500;
}

/* Custom active item styling to ensure readability */
.custom-menu-item-active {
  background-color: v-bind('isDarkTheme ? "#333333" : "#E8F5F5"') !important;
  border-left: 3px solid #8BE9FD;
  box-shadow: v-bind('isDarkTheme ? "0 0 8px rgba(0, 0, 0, 0.5)" : "0 0 8px rgba(0, 0, 0, 0.1)"');
  padding-left: 13px; /* Compensate for the border */
}

.custom-menu-item-active .menu-icon {
  color: #8BE9FD;
}

.custom-menu-item-active .menu-text {
  color: v-bind('isDarkTheme ? "#FFFFFF" : "#333333"');
  font-weight: 700;
}

.drawer-list {
  background-color: v-bind('isDarkTheme ? "#1E1E1E" : "#FFFFFF"') !important;
  padding: 8px;
}

.drawer-header {
  border-bottom: 1px solid rgba(139, 233, 253, 0.1);
}

.drawer-header :deep(.v-list-item-title) {
  color: v-bind('isDarkTheme ? "#8BE9FD" : "#26A69A"') !important;
  font-weight: 600;
}

.drawer-header :deep(.v-list-item-subtitle) {
  color: v-bind('isDarkTheme ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)"') !important;
}

.drawer-divider {
  border-color: rgba(139, 233, 253, 0.1) !important;
}

.drawer-item {
  margin-bottom: 4px;
  transition: all 0.3s;
}

.drawer-item :deep(.v-list-item__content) {
  color: v-bind('isDarkTheme ? "#F8F8F2" : "#333333"') !important;
}

.drawer-item :deep(.v-icon) {
  color: rgba(139, 233, 253, 0.7) !important;
}

.drawer-item-active {
  background-color: #1A1A1A !important;
  border-left: 3px solid #8BE9FD;
  box-shadow: 0 0 8px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(139, 233, 253, 0.3);
  position: relative;
  z-index: 1;
  color: white !important;
}

.drawer-item-active :deep(.v-list-item__content) {
  color: #FFFFFF !important;
  font-weight: 700;
}

.drawer-item-active :deep(.v-list-item-title) {
  color: #FFFFFF !important;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
}

.drawer-item-active :deep(.v-icon) {
  color: #8BE9FD !important;
}

.drawer-item:hover {
  background-color: rgba(100, 216, 203, 0.05) !important;
}

.close-btn:hover {
  color: #8BE9FD !important;
}
</style>
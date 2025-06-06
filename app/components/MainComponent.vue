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
      <v-window v-show="metricsReady && metrics.length" v-model="tab">
        <v-window-item v-for="item in tabItems" :key="item" :value="item">
          <v-card flat>
            <MetricsViewer v-if="item === itemName" :metrics="metrics" />
            <BreakdownComponent v-if="item === 'languages'" :metrics="metrics" :breakdown-key="'language'" />
            <BreakdownComponent v-if="item === 'editors'" :metrics="metrics" :breakdown-key="'editor'" />
            <CopilotChatViewer v-if="item === 'copilot chat'" :metrics="metrics" />
            <SeatsAnalysisViewer v-if="item === 'seat analysis'" :seats="seats" />
            <ApiResponse
v-if="item === 'api response'" :metrics="metrics" :original-metrics="originalMetrics"
              :seats="seats" />
          </v-card>
        </v-window-item>
        <v-alert
v-show="metricsReady && metrics.length == 0" density="compact" text="No data available to display"
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

export default defineNuxtComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
    BreakdownComponent,
    CopilotChatViewer,
    SeatsAnalysisViewer,
    ApiResponse
  },
  methods: {
    logout() {
      const { clear } = useUserSession()
      this.metrics = [];
      this.seats = [];
      // console.log('metrics are now', this.metrics);
      clear();
    }
  },

  data() {
    return {
      tabItems: ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response'],
      tab: null
    }
  },
  created() {
    this.tabItems.unshift(this.itemName);
  },
  async setup() {
    const { loggedIn, user } = useUserSession()
    const config = useRuntimeConfig();
    const showLogoutButton = computed(() => config.public.usingGithubAuth && loggedIn.value);
    const mockedDataMessage = computed(() => config.public.isDataMocked ? 'Using mock data - see README if unintended' : '');
    const itemName = computed(() => config.public.scope);
    const githubInfo = getDisplayName(config.public)
    const displayName = computed(() => githubInfo);

    const metricsReady = ref(false);
    const metrics = ref<Metrics[]>([]);
    const originalMetrics = ref<CopilotMetrics[]>([]);
    const seatsReady = ref(false);
    const seats = ref<Seat[]>([]);
    // API Error Message
    const apiError = ref<string | undefined>(undefined);
    const signInRequired = computed(() => {
      return config.public.usingGithubAuth && !loggedIn.value;
    });

    /**
     * Handles API errors by setting appropriate error messages.
     * @param {H3Error} error - The error object returned from the API call.
     */
    function processError(error: H3Error) {
      console.error(error || 'No data returned from API');
      // Check the status code of the error response
      if (error.statusCode) {
        switch (error.statusCode) {
          case 401:
            apiError.value = '401 Unauthorized access returned by GitHub API - check if your token in the .env (for local runs). Check PAT token and GitHub permissions.';
            break;
          case 404:
            apiError.value = `404 Not Found - is the ${config.public.scope || ''} org:"${config.public.githubOrg || ''}" ent:"${config.public.githubEnt || ''}" team:"${config.public.githubTeam}" correct? ${error.message}`;
            break;
          case 422:
            apiError.value = `422 Unprocessable Entity - Is the Copilot Metrics API enabled for the Org/Ent? ${error.message}`;
            break;
          case 500:
            apiError.value = `500 Internal Server Error - most likely a bug in the app. Error: ${error.message}`;
            break;
          default:
            apiError.value = `${error.statusCode} Error: ${error.message}`;
            break;
        }
      }
    }

    const metricsFetch = useFetch('/api/metrics');
    const seatsFetch = useFetch('/api/seats');

    const { data: metricsData, error: metricsError } = await metricsFetch;
    if (metricsError.value || !metricsData.value) {
      processError(metricsError.value as H3Error);
    } else {
      const apiResponse = metricsData.value as MetricsApiResponse;
      metrics.value = apiResponse.metrics || [];
      originalMetrics.value = apiResponse.usage || [];
      metricsReady.value = true;
    }

    if (config.public.scope === 'team' && metrics.value.length === 0 && !apiError.value) {
      apiError.value = 'No data returned from API - check if the team exists and has any activity and at least 5 active members';
    }

    const { data: seatsData, error: seatsError } = await seatsFetch;
    if (seatsError.value) {
      processError(seatsError.value as H3Error);
    } else {
      seats.value = seatsData.value || [];
      seatsReady.value = true;
    }

    return {
      metricsReady,
      metrics,
      originalMetrics,
      seatsReady,
      seats,
      apiError,
      signInRequired,
      showLogoutButton,
      config,
      mockedDataMessage,
      itemName,
      displayName,
      user
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
</style>
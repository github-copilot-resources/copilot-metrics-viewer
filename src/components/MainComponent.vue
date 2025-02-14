<template>
  <v-card>
    <v-toolbar color="indigo" elevation="4">
      <v-btn icon>
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title class="toolbar-title">Copilot Metrics Viewer | {{ capitalizedItemName }} : {{ displayedViewName }}  {{ teamName }}</v-toolbar-title>
      <h2 class="error-message"> {{ mockedDataMessage }} </h2>
      <v-spacer></v-spacer>

      <!-- Conditionally render the logout button -->
      <v-btn v-if="showLogoutButton" href="/logout" class="logout-button">Logout</v-btn>

      <template v-slot:extension>
        <v-tabs v-model="tab" align-tabs="title">
          <v-tab v-for="item in tabItems" :key="item" :value="item">
            {{ item }}
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>

    <!-- API Error Message -->
    <div v-if="apiError && !signInRequired" class="error-message" v-html="apiError"></div>
    <div v-if="signInRequired" class="github-login-container">
      <a href="/login" class="github-login-button">
        <v-icon left>mdi-github</v-icon>
        Sign in with GitHub
      </a>
    </div>
    <div v-if="!apiError">
      <v-progress-linear v-if="!metricsReady" indeterminate color="indigo"></v-progress-linear>
      <v-window v-if="metricsReady" v-model="tab">
        <v-window-item v-for="item in tabItems" :key="item" :value="item">
          <v-card flat>
            <MetricsViewer v-if="item === itemName" :metrics="metrics" />
            <BreakdownComponent v-if="item === 'languages'" :metrics="metrics" :breakdownKey="'language'" />
            <BreakdownComponent v-if="item === 'editors'" :metrics="metrics" :breakdownKey="'editor'" />
            <CopilotChatViewer v-if="item === 'copilot chat'" :metrics="metrics" />
            <SeatsAnalysisViewer v-if="item === 'seat analysis'" :seats="seats" />
            <ApiResponse v-if="item === 'api response'" :metrics="metrics" :originalMetrics="originalMetrics" :seats="seats" />
            <MultiTeamsMetricsViewer 
              v-if="item === 'multi-teams metrics'" 
              :teams="teams"
            />
          </v-card>
        </v-window-item>
      </v-window>
    </div>
  </v-card>
</template>

<script lang='ts'>
import { defineComponent, ref } from 'vue'
import { getMetricsApi, getTeamMetricsApi, getMultipleTeamsMetricsApi, getTeams } from '../api/GitHubApi';
import { getSeatsApi } from '../api/ExtractSeats';
import { Metrics } from '../model/Metrics';
import { CopilotMetrics } from '../model/Copilot_Metrics';
import { Seat } from "../model/Seat";

// Components
import MetricsViewer from './MetricsViewer.vue'
import BreakdownComponent from './BreakdownComponent.vue' 
import CopilotChatViewer from './CopilotChatViewer.vue' 
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue'
import ApiResponse from './ApiResponse.vue'
import MultiTeamsMetricsViewer from './MultiTeamsMetricsViewer.vue'
import config from '../config';

export default defineComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
    BreakdownComponent,
    CopilotChatViewer,
    SeatsAnalysisViewer,
    ApiResponse,
    MultiTeamsMetricsViewer
  },
  computed: {
    gitHubOrgName() {
      return config.github.org;
    },
    itemName() {
      return config.scope.type;
    },
    capitalizedItemName(): string {
      return this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1);
    },
    displayedViewName(): string {
      return config.scope.name;
    },
    isScopeOrganization() {
      return config.scope.type === 'organization';
    },
    teamName() {
      var teamName;
      if (config.github.team && config.github.team.trim() !== '') {
        teamName = "| Team : " + config.github.team;
      } else {
        teamName = '';
      }
      return teamName;
    },
    mockedDataMessage() {
      return config.mockedData ? 'Using mock data - see README if unintended' : '';
    },
    showLogoutButton() {
      return config.github.baseApi === '/api/github';
    }
  },
  data() {
    return {
      tabItems: ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response'],
      selectedTeams: []
    }
  },
  created() {
    this.tabItems.unshift(this.itemName);
    if (config.showMultipleTeams) {
      this.tabItems.push('multi-teams metrics');
    }
  },
  setup() {
    const metricsReady = ref(false);
    const metrics = ref<Metrics[]>([]);
    const originalMetrics = ref<CopilotMetrics[]>([]);
    const seatsReady = ref(false); 
    const seats = ref<Seat[]>([]); 
    const teams = ref<string[]>([]);
    const teamMetrics = ref<{ team: string, metrics: Metrics[] }[]>([]);
    const currentTab = ref(null);

    // Update metrics handler for MultiTeamsMetricsViewer
    const updateMetrics = (newMetrics: Metrics[]) => {
      metrics.value = newMetrics;
      metricsReady.value = true;
    };

    // API Error Message
    const apiError = ref<string | undefined>(undefined);
    const signInRequired = ref(false);

    /**
     * Handles API errors by setting appropriate error messages.
     * @param {any} error - The error object returned from the API call.
     */
    function processError(error: any) {
      console.log(error);
      // Check the status code of the error response
      if (error.response && error.response.status) {
        switch (error.response.status) {
          case 401:
            apiError.value = '401 Unauthorized access - check if your token in the .env file is correct.';
            if (config.github.baseApi === '/api/github') {
              // show sign in button only when using the Proxy
              signInRequired.value = true;
            }
            break;
          case 404:
            apiError.value = `404 Not Found - is the ${config.scope.type} '${config.scope.name}' correct?`;
            // Update apiError with the error message
            apiError.value = error.message;
        }
        // Add a new line to the apiError message
        apiError.value += ' <br> If .env file is modified, restart the app for the changes to take effect.';
      }
    }

    // Generated by Copilot
    if (config.github.team && config.github.team.trim() !== '') {
      getTeamMetricsApi().then(data => {
        metrics.value = data.metrics;
        originalMetrics.value = data.original;
        teamMetrics.value = data.teamMetrics;
        metricsReady.value = true;  
      }).catch(processError);
    } else {
      if (metricsReady.value === false) {
        getMetricsApi().then(data => {
          metrics.value = data.metrics;
          originalMetrics.value = data.original;
          metricsReady.value = true;
        }).catch(processError);
      }
    }

    getSeatsApi().then(data => {
      seats.value = data;
      seatsReady.value = true;
    }).catch(processError);

    if (config.showMultipleTeams) {
      getTeams().then(data => {
        teams.value = data;
        console.log("Teams data in getTeams: ", teams.value);
      }).catch(processError);
    }

    return { 
      metricsReady, 
      metrics, 
      originalMetrics, 
      seatsReady, 
      seats, 
      apiError, 
      signInRequired, 
      teams, 
      teamMetrics, 
      processError,
      tab: currentTab,
      updateMetrics
    };
  },
  methods: {
    fetchMetricsForSelectedTeams() {
      if (this.selectedTeams.length > 0) {
        getMultipleTeamsMetricsApi(this.selectedTeams).then(data => {
          this.metrics = data.metrics;
          this.originalMetrics = data.original;
          this.teamMetrics = data.teamMetrics;
          this.metricsReady = true;
        }).catch(this.processError);
      }
    }
  }
});
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
</style>
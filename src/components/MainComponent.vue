<template>
  <v-card>
    <v-toolbar color="indigo" elevation="4">
      <v-btn icon>
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title class="toolbar-title">Copilot Metrics Viewer | {{ capitalizedItemName }} : {{ displayedViewName }}  {{ teamName }}
         
      </v-toolbar-title>
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
            <ApiResponse v-if="item === 'api response'" :metrics="metrics" :seats="seats" />
          </v-card>
        </v-window-item>
      </v-window>
    </div>

  </v-card>
</template>

<script lang='ts'>
import { defineComponent, ref } from 'vue'
import { getMetricsApi } from '../api/GitHubApi';
import { getTeamMetricsApi } from '../api/GitHubApi';
import { getSeatsApi } from '../api/ExtractSeats';
import { Metrics } from '../model/Metrics';
import { Seat } from "../model/Seat";

//Components
import MetricsViewer from './MetricsViewer.vue'
import BreakdownComponent from './BreakdownComponent.vue' 
import CopilotChatViewer from './CopilotChatViewer.vue' 
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue'
import ApiResponse from './ApiResponse.vue'
import config from '../config';

export default defineComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
    BreakdownComponent,
    CopilotChatViewer,
    SeatsAnalysisViewer,
    ApiResponse
  },
  computed: {
    gitHubOrgName() {
      return config.github.org;
    },
    itemName() {
      return config.scope.type;
    },
    capitalizedItemName():string {
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
  data () {
    return {
      tabItems: ['languages', 'editors', 'copilot chat', 'seat analysis', 'api response'],
      tab: null
    }
  },
  created() {
    this.tabItems.unshift(this.itemName);
  },
  setup() {
      const metricsReady = ref(false);
      const metrics = ref<Metrics[]>([]);
      const seatsReady = ref(false); 
      const seats = ref<Seat[]>([]); 
      // API Error Message
      const apiError = ref<string | undefined>(undefined);
      const signInRequired = ref(false);
      
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

      if(config.github.team && config.github.team.trim() !== '') {
          getTeamMetricsApi().then(data => {
          metrics.value = data;

          // Set metricsReady to true after the call completes.
          metricsReady.value = true;
        }).catch(processError);
      }

      if (metricsReady.value === false) {
        getMetricsApi().then(data => {
          metrics.value = data;

          // Set metricsReady to true after the call completes.
          metricsReady.value = true;
            
        }).catch(processError);
    }
     
    getSeatsApi().then(data => {
          seats.value = data;

          // Set seatsReady to true after the call completes.
          seatsReady.value = true;
            
        }).catch(processError);

      return { metricsReady, metrics, seatsReady, seats, apiError, signInRequired };
    }
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
</style>
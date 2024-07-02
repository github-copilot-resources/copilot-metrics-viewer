<template>
  <v-card>
    <v-toolbar color="indigo" elevation="4">
      <v-btn icon>
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title class="toolbar-title">Copilot Metrics Viewer | {{ capitalizedItemName }} : {{ displayedViewName }}</v-toolbar-title>
      <h2 class="error-message"> {{ mockedDataMessage }} </h2>
      <v-spacer></v-spacer>

      <template v-slot:extension>
        <v-tabs v-model="tab" align-tabs="title">
          <v-tab v-for="item in tabItems" :key="item" :value="item">
            {{ item }}
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>

    <!-- API Error Message -->
    <div v-if="apiError" class="error-message" v-html="apiError"></div>
    <div v-if="!apiError">
      <div v-if="itemName === 'invalid'" class="error-message">Invalid Scope in .env file. Please check the value of VUE_APP_SCOPE.</div>
      <div v-else>
        <v-progress-linear v-if="!metricsReady" indeterminate color="indigo"></v-progress-linear>
        <v-window v-if="metricsReady" v-model="tab">
          <v-window-item v-for="item in tabItems" :key="item" :value="item">
            <v-card flat>
              <MetricsViewer v-if="item === itemName" :metrics="metrics" />
              <BreakdownComponent v-if="item === 'languages'" :metrics="metrics" :breakdownKey="'language'"/>
              <BreakdownComponent v-if="item === 'editors'" :metrics="metrics" :breakdownKey="'editor'"/>
              <CopilotChatViewer v-if="item === 'copilot chat'" :metrics="metrics" />
                <SeatsAnalysisViewer v-if="item === 'seat analysis'" :seats="seats" />
              <ApiResponse v-if="item === 'api response'" :metrics="metrics" :seats="seats" />
            </v-card>
          </v-window-item>
        </v-window>
      </div>
    </div>

  </v-card>
</template>

<script lang='ts'>
import { defineComponent, ref } from 'vue'
import { getMetricsApi } from '../api/GitHubApi';
import { getSeatsApi } from '../api/ExtractSeats';
import { Metrics } from '../model/Metrics';
import { Seat } from "../model/Seat";

//Components
import MetricsViewer from './MetricsViewer.vue'
import BreakdownComponent from './BreakdownComponent.vue' 
import CopilotChatViewer from './CopilotChatViewer.vue' 
import SeatsAnalysisViewer from './SeatsAnalysisViewer.vue'
import ApiResponse from './ApiResponse.vue'

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
      return process.env.VUE_APP_GITHUB_ORG;
    },
    itemName() {
      if (process.env.VUE_APP_SCOPE === 'enterprise' || process.env.VUE_APP_SCOPE === 'organization') {
        return process.env.VUE_APP_SCOPE;
      } else {
        console.log("invalid");
        return 'invalid';
      }
    },
    capitalizedItemName():string {
      return this.itemName.charAt(0).toUpperCase() + this.itemName.slice(1);
    },
    displayedViewName(): string {
      return this.capitalizedItemName === 'Enterprise' ? process.env.VUE_APP_GITHUB_ENT: process.env.VUE_APP_GITHUB_ORG;
    },
    isScopeOrganization() {
      return process.env.VUE_APP_SCOPE === 'organization';
    },
    mockedDataMessage() {
      return process.env.VUE_APP_MOCKED_DATA === 'true' ? 'Using mock data - see README if unintended' : '';
    }
  },
  data () {
    return {
      tabItems: ['languages', 'editors', 'copilot chat','seat analysis' , 'api response'],
      tab: null
    }
  },
  created() {
    if(this.itemName !== 'invalid'){
      this.tabItems.unshift(this.itemName);
    }
  },
  setup() {
      const metricsReady = ref(false);
      const metrics = ref<Metrics[]>([]);
      const seatsReady = ref(false); 
      const seats = ref<Seat[]>([]); 
      // API Error Message
      const apiError = ref<string | undefined>(undefined);

      getMetricsApi().then(data => {
        metrics.value = data;

        // Set metricsReady to true after the call completes.
        metricsReady.value = true;
          
      }).catch(error => {
      console.log(error);
      // Check the status code of the error response
      if (error.response && error.response.status) {
        switch (error.response.status) {
          case 401:
            apiError.value = '401 Unauthorized access - check if your token in the .env file is correct.';
            break;
          case 404:
            apiError.value = `404 Not Found - is the organization '${process.env.VUE_APP_GITHUB_ORG}' correct?`;
            break;
          default:
            apiError.value = error.message;
            break;
        }
      } else {
        // Update apiError with the error message
        apiError.value = error.message;
      }
       // Add a new line to the apiError message
       apiError.value += ' <br> If .env file is modified, restart the app for the changes to take effect.';
        
    });
     
    getSeatsApi().then(data => {
        seats.value = data;

        // Set seatsReady to true after the call completes.
        seatsReady.value = true;
          
      }).catch(error => {
      console.log(error);
      // Check the status code of the error response
      if (error.response && error.response.status) {
        switch (error.response.status) {
          case 401:
            apiError.value = '401 Unauthorized access - check if your token in the .env file is correct.';
            break;
          case 404:
            apiError.value = `404 Not Found - is the organization '${process.env.VUE_APP_GITHUB_ORG}' correct?`;
            break;
          default:
            apiError.value = error.message;
            break;
        }
      } else {
        // Update apiError with the error message
        apiError.value = error.message;
      }
       // Add a new line to the apiError message
       apiError.value += ' <br> If .env file is modified, restart the app for the changes to take effect.';
        
    });

    return { metricsReady, metrics, seatsReady,seats,apiError };
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
</style>
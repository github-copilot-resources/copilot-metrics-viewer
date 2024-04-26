<template>
  <v-card>
    <v-toolbar color="indigo" elevation="4">
      <v-btn icon>
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title>Copilot Metrics Viewer | {{ GitHubOrgName }}</v-toolbar-title>
      <h2>  </h2>
      <v-spacer></v-spacer>

      <template v-slot:extension>
        <v-tabs v-model="tab" align-tabs="title">
          <v-tab v-for="item in items" :key="item" :value="item">
            {{ item }}
          </v-tab>
        </v-tabs>
      </template>
    </v-toolbar>

    <!-- API Error Message -->
    <div v-if="apiError" class="error-message" v-html="apiError"></div>
    <div v-if="!apiError">
      <v-progress-linear v-if="!metricsReady" indeterminate color="indigo"></v-progress-linear>
      <v-window v-if="metricsReady" v-model="tab">
        <v-window-item v-for="item in items" :key="item" :value="item">
          <v-card flat>
            <MetricsViewer v-if="item === 'organization'" :metrics="metrics" />
            <LanguagesBreakdown v-if="item === 'languages'" :metrics="metrics"/>   
            <CopilotChatViewer v-if="item === 'copilot chat'" :metrics="metrics" />
            <ApiResponse v-if="item === 'api response'" :metrics="metrics" />
          </v-card>
        </v-window-item>
      </v-window>
    </div>

  </v-card>
</template>

<script lang='ts'>
import { defineComponent, ref } from 'vue'
import { getGitHubCopilotMetricsApi } from '../api/GitHubApi';
import { Metrics } from '../model/MetricsData';

//Components
import MetricsViewer from './MetricsViewer.vue'
import LanguagesBreakdown from './LanguagesBreakdown.vue' 
import CopilotChatViewer from './CopilotChatViewer.vue' 
import ApiResponse from './ApiResponse.vue'



export default defineComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
    LanguagesBreakdown,
    CopilotChatViewer,
    ApiResponse
  },
  computed: {
    GitHubOrgName() {
      return process.env.VUE_APP_GITHUB_ORG;
    }
  },
  data () {
    return {
      items: ['organization', 'languages', 'copilot chat', 'api response'],
      tab: null
    }
  },
  setup() {
      const metricsReady = ref(false);
      const metrics = ref<Metrics[]>([]);

      // API Error Message
      const apiError = ref<string | undefined>(undefined);
  
      getGitHubCopilotMetricsApi().then(data => {
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
       apiError.value += ' <br> If .env file is modified, restart the changes to take effect.';
        
    });
      
    return { metricsReady, metrics, apiError };
    }
})
</script>

<style scoped>
.error-message {
  color: red;
}
</style>

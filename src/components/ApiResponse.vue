<template>
    <!-- API Error Message -->
    <div v-if="apiError" class="error-message" v-html="apiError"></div>
    <div v-if="!apiError">
        
        <v-container>
        <!-- Displaying the JSON object -->
            <v-card max-height="600px" class="overflow-y-auto">
                <pre>{{ JSON.stringify(metrics, null, 2) }}</pre>
            </v-card>
  </v-container>
    </div>
</template>
  
  <script lang="ts">
  import { defineComponent, ref } from 'vue';
  import { getGitHubCopilotMetricsApi } from '../api/GitHubApi';
  import { Metrics } from '../model/MetricsData';
  
  export default defineComponent({
    name: 'ApiResponse',
    data () {
      return {
        data : {
          labels: ['VueJs', 'EmberJs', 'ReactJs', 'AngularJs'],
          datasets: [
            {
          backgroundColor: ['#41B883', '#E46651', '#00D8FF', '#DD1B16'],
          data: [40, 20, 80, 10]
          }
          ]
        },
        options : {
          responsive: true,
        maintainAspectRatio: false
        }
      }
    },
    setup() {
      const metrics = ref<Metrics[]>([]);

      // API Error Message
      const apiError = ref<string | null>(null);
  
      getGitHubCopilotMetricsApi().then(data => {
        metrics.value = data;
          
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
      
    return { metrics, apiError };
    },
    

  });
  </script>
  
  <style scoped>
  .error-message {
    color: red;
  }
  
  .center-table {
    margin-left: auto;
    margin-right: auto;
  }
  
  .tiles-container {
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  </style>
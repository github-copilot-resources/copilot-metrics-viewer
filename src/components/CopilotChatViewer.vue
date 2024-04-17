<template>
<div>
   </div> 
</template>
  
<script lang="ts">
  import { defineComponent, ref } from 'vue';
  import { getGitHubCopilotMetricsApi } from '../api/GitHubApi';
  import { Metrics } from '../model/MetricsData';
  
  
  export default defineComponent({
    name: 'CopilotChatViewer',
    setup() {
        const metrics = ref<Metrics[]>([]);

        const apiError = ref<string>('');

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

        return {  apiError, metrics };
    }
  });
  </script>
  
  <style scoped>
  
  </style>
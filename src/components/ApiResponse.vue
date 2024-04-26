<template>
    <v-container>
        <!-- Displaying the JSON object -->
        <v-card max-height="600px" class="overflow-y-auto">
            <pre>{{ JSON.stringify(metrics, null, 2) }}</pre>
        </v-card>
    </v-container>
</template>
  
  <script lang="ts">
  import { defineComponent } from 'vue';
  
  export default defineComponent({
    name: 'ApiResponse',
    props: {
        metrics: {
            type: Object,
            required: true
        }
    },

  });
  </script>
  
  <style scoped>
  .tiles-container {
    display: flex;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  </style>
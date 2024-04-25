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
      <v-window v-model="tab">
        <v-window-item v-for="item in items" :key="item" :value="item">
          <v-card flat>
            <MetricsViewer v-if="item === 'organization'" />
            <LanguagesBreakdown v-if="item === 'languages'" />   
            <CopilotChatViewer v-if="item === 'copilot chat'" />
            <ApiResponse v-if="item === 'api response'" />
          </v-card>
        </v-window-item>
      </v-window>
  </v-card>
</template>

<script lang='ts'>
import { defineComponent } from 'vue'
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
      tab: null,
    }
  },
})
</script>

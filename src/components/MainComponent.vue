<template>
  <v-card>
    <v-toolbar color="black" elevation="4">
      <v-btn icon>
        <v-icon>mdi-github</v-icon>
      </v-btn>

      <v-toolbar-title>Copilot Metrics Viewer</v-toolbar-title>

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
          <component :is="item === 'organization' ? 'MetricsViewer' : null"></component>
        </v-card>
      </v-window-item>
    </v-window>
  </v-card>
</template>

<script lang='ts'>
import { defineComponent } from 'vue'
import MetricsViewer from './MetricsViewer.vue' // adjust the path as needed


export default defineComponent({
  name: 'MainComponent',
  components: {
    MetricsViewer,
  },

  data () {
    return {
      items: ['organization', 'enterprise', 'languages', 'Copilot chat'],
      tab: null,
    }
  },
})
</script>

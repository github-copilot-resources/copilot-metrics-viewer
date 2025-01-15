<template>
  <v-app>
    <v-main>
      <MainComponent />
    </v-main>
    <v-footer class="bg-indigo-lighten-1 text-center d-flex flex-column">
      <div class="px-4 py-2 text-center w-100">
        {{ new Date().getFullYear() }} — <strong>Copilot Metrics Viewer</strong> — {{ version }}
      </div>
    </v-footer>
  </v-app>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import MainComponent from './components/MainComponent.vue'

export default defineComponent({
  name: 'App',

  components: {
    MainComponent,
  },

  data() {
    return {
      version: process.env.VUE_APP_VERSION || '0.0.0'
    }
  },
})
</script>

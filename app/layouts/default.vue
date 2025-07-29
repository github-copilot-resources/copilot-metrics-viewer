<template>
  <v-app>
    <v-main class="bg-background">
      <slot />
    </v-main>
    <AppFooter />
  </v-app>
</template>

<script lang="ts" setup>
import AppFooter from '../components/AppFooter.vue';

const config = useRuntimeConfig();
const githubInfo = getDisplayName(config.public)
useHead({
  title: githubInfo,
  meta: [
    { name: 'description', content: 'Copilot Metrics Dashboard - Track your organization\'s GitHub Copilot usage and optimize your development workflow' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' },
    { name: 'theme-color', content: '#3F51B5' }
  ],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' }
  ]
});
</script>

<style scoped>
.bg-background {
  background-color: var(--v-theme-background);
  min-height: calc(100vh - 300px); /* Ensure content area is tall enough */
}
</style>
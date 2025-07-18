<template>
  <v-app>
    <v-main>
      <slot />
    </v-main>
    <v-footer class="bg-primary text-center d-flex flex-column fixed-footer">
      <div class="px-4 py-2 text-center w-100 text-white">
        {{ new Date().getFullYear() }} — <strong><a href="https://github.com/github-copilot-resources/copilot-metrics-viewer" target="_blank" rel="noopener noreferrer" class="text-white text-decoration-none">Copilot Metrics Viewer</a></strong> — {{ version }}
      </div>
    </v-footer>
  </v-app>
</template>

<script lang="ts" setup>
const config = useRuntimeConfig();
const version = computed(() => config.public.version);
const githubInfo = getDisplayName(config.public)
useHead({
  title: githubInfo,
  meta: [
    { name: 'description', content: 'Copilot Metrics Dashboard' },
    { name: 'viewport', content: 'width=device-width, initial-scale=1' }
  ],
  link: [
    { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
    { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap' }
  ]
});
</script>

<style scoped>
.fixed-footer {
  height: 50px;
  max-height: 50px;
}

.text-white {
  color: white !important;
}

.text-decoration-none {
  text-decoration: none;
}

.text-decoration-none:hover {
  text-decoration: underline;
}
</style>

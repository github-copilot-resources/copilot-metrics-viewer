<template>
  <v-app>
    <v-main>
      <slot />
    </v-main>
    <v-footer class="bg-indigo-lighten-1 text-center d-flex flex-column fixed-footer">
      <div class="px-4 py-2 text-center w-100">
        {{ new Date().getFullYear() }} — <strong><a href="https://github.com/github-copilot-resources/copilot-metrics-viewer" target="_blank" rel="noopener noreferrer" style="color: inherit;">Copilot Metrics Viewer</a></strong> — {{ version }}
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
    { name: 'description', content: 'Copilot Metrics Dashboard' }
  ]
});
</script>

<style scoped>
.fixed-footer {
  height: 50px;
  max-height: 50px;
}
</style>

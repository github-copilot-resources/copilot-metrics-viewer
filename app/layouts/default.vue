<template>
  <v-app :theme="themeState">
    <v-main>
      <slot />
    </v-main>
    <v-footer class="bg-primary text-center d-flex flex-column fixed-footer">
      <div class="px-4 py-2 text-center w-100">
        {{ new Date().getFullYear() }} — <strong><a href="https://github.com/github-copilot-resources/copilot-metrics-viewer" target="_blank" rel="noopener noreferrer" style="color: inherit;">Copilot Metrics Viewer</a></strong> — {{ version }}<span v-if="deployInfo"> — {{ deployInfo }}</span>
      </div>
    </v-footer>
  </v-app>
</template>

<script lang="ts" setup>
const config = useRuntimeConfig();
const version = computed(() => config.public.version);
const deployInfo = computed(() => config.public.deployInfo);
const route = useRoute();
const pageTitle = computed(() => {
  const base = getDisplayName(config.public);
  const team = route.params.team as string;
  return team ? `${base} | Team : ${team}` : base;
});
useHead({
  title: pageTitle,
  meta: [
    { name: 'description', content: 'Copilot Metrics Dashboard' }
  ]
});

const themeState = useState('app-theme', () => 'light');
onMounted(() => {
  const saved = localStorage.getItem('copilot-metrics-theme');
  if (saved === 'light' || saved === 'dark') themeState.value = saved;
});
</script>

<style scoped>
.fixed-footer {
  height: 50px;
  max-height: 50px;
}
</style>

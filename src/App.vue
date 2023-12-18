<template>
  <AppHeader />
  <MetricsViewer />
</template>

<script lang="ts">
import { defineComponent } from 'vue';
import MetricsViewer from './components/MetricsViewer.vue';
import AppHeader from './components/AppHeader.vue';

export default defineComponent({
  name: 'App',
  components: {
    MetricsViewer,
    AppHeader
}
});
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
}
</style>

<template>
  <div>
    <v-card>
      <v-toolbar color="indigo" elevation="4">
        <v-toolbar-title>Multi-Teams Metrics Viewer</v-toolbar-title>
      </v-toolbar>
      <v-container>
        <v-row>
          <v-col cols="12">
            <v-select
              v-model="selectedTeams"
              :items="teams"
              label="Select Teams"
              multiple
              chips
              clearable
              @change="fetchMetricsForSelectedTeams"
            ></v-select>
          </v-col>
        </v-row>
        <v-row>
          <v-col cols="12">
            <MetricsViewer v-if="metricsReady" :metrics="metrics" />
            <v-progress-linear v-else indeterminate color="indigo"></v-progress-linear>
          </v-col>
        </v-row>
      </v-container>
    </v-card>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, watch } from 'vue';
import { getMultipleTeamsMetricsApi } from '../api/GitHubApi';
import { Metrics } from '../model/Metrics';
import MetricsViewer from './MetricsViewer.vue';

export default defineComponent({
  name: 'MultiTeamsMetricsViewer',
  components: {
    MetricsViewer
  },
  props: {
    teams: {
      type: Array,
      required: true
    }
  },
  setup(props) {
    const selectedTeams = ref<string[]>([]);
    const metrics = ref<Metrics[]>([]);
    const metricsReady = ref(false);

    watch(selectedTeams, (newTeams) => {
      if (newTeams.length > 0) {
        fetchMetricsForSelectedTeams();
      }
    });

    const fetchMetricsForSelectedTeams = async () => {
      metricsReady.value = false;
      const data = await getMultipleTeamsMetricsApi(selectedTeams.value);
      metrics.value = data.metrics;
      metricsReady.value = true;
    };

    return { selectedTeams, metrics, metricsReady, fetchMetricsForSelectedTeams };
  }
});
</script>

<style scoped>
.v-toolbar-title {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>

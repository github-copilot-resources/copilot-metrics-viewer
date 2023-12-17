<template>
    <div>
      <h1>GitHub Copilot Metrics</h1>
    </div>
    <div>
          <div v-if="loading">Loading...</div>
          <div v-else-if="error">{{ error }}</div>
          <div v-else>
              <div v-for="metric in metrics" :key="metric.day">
                      <h2>{{ metric.day }}</h2>
                      <p>Total Suggestions: {{ metric.total_suggestions_count }}</p>
                      <p>Total Acceptances: {{ metric.total_acceptances_count }}</p>
                      <p>Total Lines Suggested: {{ metric.total_lines_suggested }}</p>
                      <p>Total Lines Accepted: {{ metric.total_lines_accepted }}</p>
                      <p>Total Active Users: {{ metric.total_active_users }}</p>
                      <h3>Breakdown</h3>
                      <div v-for="breakdown in metric.breakdown" :key="breakdown.language">
                          <h4>{{ breakdown.language }}</h4>
                          <p>Editor: {{ breakdown.editor }}</p>
                          <p>Suggestions Count: {{ breakdown.suggestions_count }}</p>
                          <p>Acceptances Count: {{ breakdown.acceptances_count }}</p>
                          <p>Lines Suggested: {{ breakdown.lines_suggested }}</p>
                          <p>Lines Accepted: {{ breakdown.lines_accepted }}</p>
                          <p>Active Users: {{ breakdown.active_users }}</p>
                      </div>
                  </div>
              </div>
          </div>
  </template>
  
  <script lang="ts">
  import { defineComponent, ref } from 'vue';
  import { getGitHubCopilotMetricsApi } from '../api/GitHubApi';
  import { Metrics } from '../model/MetricsData';
  
  export default defineComponent({
    name: 'RawDataViewer',
    data() {
      return {
        loading: false,
        error: null,
        metrics: [] as Metrics[]
      };
    },
    methods: {
      async fetchMetrics(): Promise<void> {
        console.log('fetchMetrics');
        this.loading = true;
        this.error = null;
        try {
          this.metrics = await getGitHubCopilotMetricsApi();
        } catch (error) {
          this.error = error as any;
        } finally {
          this.loading = false;
        }
      }
    },
    created() {
      console.log('MetricsViewer create');
      this.fetchMetrics();
    }
  });
  </script>
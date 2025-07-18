<template>
  <v-row class="stats-summary mb-6">
    <v-col v-for="(stat, index) in stats" :key="index" cols="12" sm="6" md="3">
      <MetricCard
        :title="stat.label"
        :value="stat.value"
        :icon="stat.icon"
        :color="stat.color"
        :is-dark-theme="isDarkTheme"
      />
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { Metrics } from '@/model/Metrics';
import MetricCard from './MetricCard.vue';

const props = defineProps({
  metrics: {
    type: Array as () => Metrics[],
    required: true
  },
  isDarkTheme: {
    type: Boolean,
    default: false
  }
});

// Calculate summary statistics from metrics
const stats = computed(() => {
  // Default values in case metrics are empty
  let totalSuggestions = 0;
  let acceptanceRate = 0;
  let totalUsers = 0;
  let avgSuggestionsPerUser = 0;

  if (props.metrics && props.metrics.length > 0) {
    // Calculate total suggestions
    totalSuggestions = props.metrics.reduce((sum, metric) => sum + (metric.suggestions_count || 0), 0);
    
    // Calculate acceptance rate
    const totalAccepted = props.metrics.reduce((sum, metric) => sum + (metric.accepted_suggestions_count || 0), 0);
    acceptanceRate = totalSuggestions > 0 ? Math.round((totalAccepted / totalSuggestions) * 100) : 0;
    
    // Calculate unique users
    const uniqueUsers = new Set();
    props.metrics.forEach(metric => {
      if (metric.user_id) uniqueUsers.add(metric.user_id);
    });
    totalUsers = uniqueUsers.size;
    
    // Calculate average suggestions per user
    avgSuggestionsPerUser = totalUsers > 0 ? Math.round(totalSuggestions / totalUsers) : 0;
  }

  return [
    {
      label: 'Total Suggestions',
      value: totalSuggestions.toLocaleString(),
      icon: 'mdi-lightbulb-outline',
      color: 'primary',
      description: 'Total number of suggestions offered by Copilot'
    },
    {
      label: 'Acceptance Rate',
      value: `${acceptanceRate}%`,
      icon: 'mdi-check-circle-outline',
      color: 'success',
      description: 'Percentage of suggestions accepted by users'
    },
    {
      label: 'Active Users',
      value: totalUsers.toLocaleString(),
      icon: 'mdi-account-group',
      color: 'info',
      description: 'Number of users actively using Copilot'
    },
    {
      label: 'Avg. Suggestions/User',
      value: avgSuggestionsPerUser.toLocaleString(),
      icon: 'mdi-chart-line',
      color: 'accent',
      description: 'Average number of suggestions per active user'
    }
  ];
});
</script>

<style scoped>
.stats-summary {
  margin-top: 16px;
}
</style>
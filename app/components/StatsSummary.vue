<template>
  <v-row class="stats-summary mb-6">
    <v-col v-for="(stat, index) in stats" :key="index" cols="12" sm="6" md="3">
      <v-card class="stat-card h-100" :class="{ 'theme--dark': isDarkTheme }">
        <v-card-text class="d-flex flex-column align-center justify-center text-center pa-4">
          <div class="stat-icon mb-4" :class="`bg-${stat.color}`">
            <v-icon size="large" :color="stat.color">{{ stat.icon }}</v-icon>
          </div>
          <h3 class="text-h4 font-weight-bold mb-1">{{ stat.value }}</h3>
          <p class="text-subtitle-2 text-medium-emphasis mb-0">{{ stat.label }}</p>
        </v-card-text>
      </v-card>
    </v-col>
  </v-row>
</template>

<script setup lang="ts">
import type { Metrics } from '@/model/Metrics';

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
      color: 'primary'
    },
    {
      label: 'Acceptance Rate',
      value: `${acceptanceRate}%`,
      icon: 'mdi-check-circle-outline',
      color: 'success'
    },
    {
      label: 'Active Users',
      value: totalUsers.toLocaleString(),
      icon: 'mdi-account-group',
      color: 'info'
    },
    {
      label: 'Avg. Suggestions/User',
      value: avgSuggestionsPerUser.toLocaleString(),
      icon: 'mdi-chart-line',
      color: 'accent'
    }
  ];
});
</script>

<style scoped>
.stats-summary {
  margin-top: 16px;
}

.stat-card {
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 12px;
  height: 100%;
}

.stat-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
}

.theme--dark.stat-card:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3) !important;
}

.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 64px;
  height: 64px;
  border-radius: 50%;
}

.bg-primary {
  background-color: rgba(63, 81, 181, 0.1);
}

.bg-success {
  background-color: rgba(76, 175, 80, 0.1);
}

.bg-info {
  background-color: rgba(33, 150, 243, 0.1);
}

.bg-accent {
  background-color: rgba(83, 109, 254, 0.1);
}

.theme--dark .bg-primary {
  background-color: rgba(92, 107, 192, 0.2);
}

.theme--dark .bg-success {
  background-color: rgba(102, 187, 106, 0.2);
}

.theme--dark .bg-info {
  background-color: rgba(66, 165, 245, 0.2);
}

.theme--dark .bg-accent {
  background-color: rgba(124, 77, 255, 0.2);
}
</style>
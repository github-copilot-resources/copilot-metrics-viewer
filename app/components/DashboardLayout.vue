<template>
  <div class="dashboard-layout">
    <v-row>
      <v-col cols="12">
        <h2 class="text-h5 font-weight-bold mb-4 d-flex align-center section-heading">
          <v-icon color="primary" class="mr-2">{{ icon }}</v-icon>
          <span class="section-title">{{ title }}</span>
          <div v-if="dateRange" class="ml-2 custom-date-badge">
            <v-icon class="date-icon">mdi-calendar-range</v-icon>
            <span class="date-text">{{ dateRange }}</span>
          </div>
        </h2>
      </v-col>
    </v-row>
    
    <v-row v-if="showMetricCards && metrics && metrics.length">
      <v-col cols="12" sm="6" md="3">
        <MetricCard
          title="Total Suggestions"
          :value="formatNumber(totalSuggestions)"
          description="Total number of suggestions offered by Copilot"
          icon="mdi-lightbulb-outline"
          color="primary"
          :is-dark-theme="isDarkTheme"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <MetricCard
          title="Acceptance Rate"
          :value="`${acceptanceRate}%`"
          description="Percentage of suggestions accepted by users"
          icon="mdi-check-circle-outline"
          color="success"
          :trend="acceptanceTrend"
          :is-dark-theme="isDarkTheme"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <MetricCard
          title="Active Users"
          :value="formatNumber(activeUsers)"
          description="Number of users actively using Copilot"
          icon="mdi-account-group"
          color="info"
          :is-dark-theme="isDarkTheme"
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <MetricCard
          title="Avg. Suggestions/User"
          :value="formatNumber(avgSuggestionsPerUser)"
          description="Average number of suggestions per active user"
          icon="mdi-chart-line"
          color="accent"
          :is-dark-theme="isDarkTheme"
        />
      </v-col>
    </v-row>
    
    <v-divider v-if="showMetricCards && metrics && metrics.length" class="my-6"></v-divider>
    
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import MetricCard from './MetricCard.vue';
import type { Metrics } from '@/model/Metrics';

const props = defineProps({
  title: {
    type: String,
    required: true
  },
  icon: {
    type: String,
    default: 'mdi-view-dashboard-outline'
  },
  dateRange: {
    type: String,
    default: ''
  },
  metrics: {
    type: Array as () => Metrics[],
    default: () => []
  },
  showMetricCards: {
    type: Boolean,
    default: true
  },
  isDarkTheme: {
    type: Boolean,
    default: false
  }
});

// Calculate metrics
const totalSuggestions = computed(() => {
  if (!props.metrics || props.metrics.length === 0) return 0;
  return props.metrics.reduce((sum, metric) => sum + (metric.suggestions_count || 0), 0);
});

const acceptanceRate = computed(() => {
  if (!props.metrics || props.metrics.length === 0 || totalSuggestions.value === 0) return 0;
  const totalAccepted = props.metrics.reduce((sum, metric) => sum + (metric.accepted_suggestions_count || 0), 0);
  return Math.round((totalAccepted / totalSuggestions.value) * 100);
});

// Simulate a trend (in a real app, this would compare with previous period)
const acceptanceTrend = computed(() => {
  // This is just a placeholder - in a real app you'd compare with previous period
  return Math.floor(Math.random() * 21) - 10; // Random number between -10 and 10
});

const activeUsers = computed(() => {
  if (!props.metrics || props.metrics.length === 0) return 0;
  const uniqueUsers = new Set();
  props.metrics.forEach(metric => {
    if (metric.user_id) uniqueUsers.add(metric.user_id);
  });
  return uniqueUsers.size;
});

const avgSuggestionsPerUser = computed(() => {
  if (activeUsers.value === 0) return 0;
  return Math.round(totalSuggestions.value / activeUsers.value);
});

// Format numbers with commas
function formatNumber(num: number): string {
  return num.toLocaleString();
}
</script>

<style scoped>
.dashboard-layout {
  margin-bottom: 32px;
}

.section-heading {
  position: relative;
  z-index: 1;
}

.section-title {
  color: white !important;
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  position: relative;
  z-index: 2;
}

.custom-date-badge {
  display: inline-flex;
  align-items: center;
  background-color: #000000;
  color: #FFFFFF;
  font-weight: 700;
  border: 2px solid #8BE9FD;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
  padding: 6px 12px;
  border-radius: 4px;
  margin-left: 12px;
}

.date-icon {
  color: #8BE9FD;
  margin-right: 6px;
  font-size: 18px;
}

.date-text {
  color: #FFFFFF;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.8);
  letter-spacing: 0.5px;
  font-size: 0.9rem;
}
</style>
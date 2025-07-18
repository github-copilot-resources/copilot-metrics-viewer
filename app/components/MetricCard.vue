<template>
  <v-card class="metric-card h-100" :class="{ 'theme--dark': isDarkTheme }">
    <div class="card-accent" :class="`bg-${color}`"></div>
    <v-card-text class="d-flex flex-column h-100">
      <div class="d-flex align-center mb-4">
        <div class="icon-container" :class="`bg-${color}-light`">
          <v-icon :color="color">{{ icon }}</v-icon>
        </div>
        <h3 class="text-subtitle-1 font-weight-medium ml-2 mb-0">{{ title }}</h3>
      </div>
      
      <div class="metric-value mb-2">
        <span class="text-h4 font-weight-bold">{{ value }}</span>
        <span v-if="trend" class="trend-indicator ml-2" :class="trendClass">
          <v-icon size="small" class="mr-1">{{ trendIcon }}</v-icon>
          {{ trend }}%
        </span>
      </div>
      
      <p class="text-caption text-medium-emphasis mb-0 mt-auto">{{ description }}</p>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
const props = defineProps({
  title: {
    type: String,
    required: true
  },
  value: {
    type: [String, Number],
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  icon: {
    type: String,
    default: 'mdi-chart-bar'
  },
  color: {
    type: String,
    default: 'primary'
  },
  trend: {
    type: Number,
    default: null
  },
  isDarkTheme: {
    type: Boolean,
    default: false
  }
});

const trendClass = computed(() => {
  if (props.trend === null) return '';
  return props.trend >= 0 ? 'trend-up' : 'trend-down';
});

const trendIcon = computed(() => {
  if (props.trend === null) return '';
  return props.trend >= 0 ? 'mdi-arrow-up' : 'mdi-arrow-down';
});
</script>

<style scoped>
.metric-card {
  position: relative;
  overflow: hidden;
  transition: transform 0.3s, box-shadow 0.3s;
  border-radius: 12px;
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1) !important;
}

.theme--dark.metric-card:hover {
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3) !important;
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.bg-primary {
  background-color: var(--v-theme-primary);
}

.bg-primary-light {
  background-color: rgba(63, 81, 181, 0.1);
}

.bg-success {
  background-color: var(--v-theme-success);
}

.bg-success-light {
  background-color: rgba(76, 175, 80, 0.1);
}

.bg-info {
  background-color: var(--v-theme-info);
}

.bg-info-light {
  background-color: rgba(33, 150, 243, 0.1);
}

.bg-warning {
  background-color: var(--v-theme-warning);
}

.bg-warning-light {
  background-color: rgba(255, 167, 38, 0.1);
}

.bg-error {
  background-color: var(--v-theme-error);
}

.bg-error-light {
  background-color: rgba(239, 83, 80, 0.1);
}

.bg-accent {
  background-color: var(--v-theme-accent);
}

.bg-accent-light {
  background-color: rgba(83, 109, 254, 0.1);
}

.trend-indicator {
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}

.trend-up {
  color: var(--v-theme-success);
}

.trend-down {
  color: var(--v-theme-error);
}

.theme--dark .bg-primary-light {
  background-color: rgba(92, 107, 192, 0.2);
}

.theme--dark .bg-success-light {
  background-color: rgba(102, 187, 106, 0.2);
}

.theme--dark .bg-info-light {
  background-color: rgba(66, 165, 245, 0.2);
}

.theme--dark .bg-warning-light {
  background-color: rgba(255, 167, 38, 0.2);
}

.theme--dark .bg-error-light {
  background-color: rgba(239, 83, 80, 0.2);
}

.theme--dark .bg-accent-light {
  background-color: rgba(124, 77, 255, 0.2);
}
</style>
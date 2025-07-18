<template>
  <v-card class="metric-card h-100" :class="{ 'theme--dark': isDarkTheme }">
    <div class="card-accent"></div>
    <v-card-text class="d-flex flex-column h-100">
      <div class="d-flex align-center mb-4">
        <div class="icon-container" :class="`icon-${color}`">
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
  background-color: rgba(18, 18, 18, 0.8) !important;
  border: 1px solid rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(10px);
}

.metric-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(100, 216, 203, 0.15) !important;
  border: 1px solid rgba(139, 233, 253, 0.2);
}

.theme--dark.metric-card:hover {
  box-shadow: 0 8px 24px rgba(100, 216, 203, 0.15) !important;
}

.card-accent {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: linear-gradient(90deg, #8BE9FD, #64D8CB, #9C64D8) !important;
  background-size: 200% 100%;
  animation: shimmer 3s infinite;
}

.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 8px;
}

.icon-primary {
  background-color: rgba(100, 216, 203, 0.15);
  box-shadow: 0 0 15px rgba(100, 216, 203, 0.1);
}

.icon-success {
  background-color: rgba(80, 250, 123, 0.15);
  box-shadow: 0 0 15px rgba(80, 250, 123, 0.1);
}

.icon-info {
  background-color: rgba(139, 233, 253, 0.15);
  box-shadow: 0 0 15px rgba(139, 233, 253, 0.1);
}

.icon-warning {
  background-color: rgba(255, 184, 108, 0.15);
  box-shadow: 0 0 15px rgba(255, 184, 108, 0.1);
}

.icon-error {
  background-color: rgba(255, 82, 82, 0.15);
  box-shadow: 0 0 15px rgba(255, 82, 82, 0.1);
}

.icon-accent {
  background-color: rgba(156, 100, 216, 0.15);
  box-shadow: 0 0 15px rgba(156, 100, 216, 0.1);
}

.trend-indicator {
  font-size: 0.875rem;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
}

.trend-up {
  color: #50FA7B;
}

.trend-down {
  color: #FF5252;
}

@keyframes shimmer {
  0% { background-position: 0% 0; }
  100% { background-position: 200% 0; }
}

.text-h4 {
  background: linear-gradient(90deg, #8BE9FD, #64D8CB, #9C64D8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
  font-weight: 700 !important;
}

.text-subtitle-1 {
  color: #8BE9FD !important;
}

.text-caption {
  color: rgba(255, 255, 255, 0.7) !important;
}
</style>
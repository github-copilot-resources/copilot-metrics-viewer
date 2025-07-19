<template>
  <v-card class="welcome-banner mb-6" :class="{ 'theme--dark': isDarkTheme }">
    <div class="banner-overlay"></div>
    <v-card-text class="position-relative">
      <div class="d-flex flex-column flex-md-row align-md-center justify-space-between">
        <div class="banner-content">
          <h1 class="text-h4 font-weight-bold mb-2">{{ greeting }}, {{ userName || 'there' }}!</h1>
          <p class="text-subtitle-1 mb-4">Welcome to the Copilot Metrics Dashboard for <strong>{{ orgName }}</strong></p>
          <p class="text-body-2 mb-6">
            Track your organization's GitHub Copilot usage, analyze trends, and optimize your development workflow.
          </p>
          <!-- Buttons removed -->
        </div>
        <div class="banner-image d-none d-md-flex">
          <v-img
            src="/images/dashboard-illustration.svg"
            alt="Dashboard Illustration"
            width="300"
            height="200"
            class="ml-auto"
          >
            <template v-slot:placeholder>
              <v-row class="fill-height ma-0" align="center" justify="center">
                <v-progress-circular indeterminate color="primary"></v-progress-circular>
              </v-row>
            </template>
          </v-img>
        </div>
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
const props = defineProps({
  userName: {
    type: String,
    default: ''
  },
  orgName: {
    type: String,
    required: true
  },
  isDarkTheme: {
    type: Boolean,
    default: false
  }
});

// Dynamic greeting based on time of day
const greeting = computed(() => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
});

// Scroll to metrics section
function scrollToMetrics() {
  const metricsElement = document.querySelector('.v-window');
  if (metricsElement) {
    metricsElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}
</script>

<style scoped>
.welcome-banner {
  position: relative;
  overflow: hidden;
  border-radius: 16px;
  background: v-bind('isDarkTheme ? "linear-gradient(135deg, #64D8CB 0%, #9C64D8 100%)" : "linear-gradient(135deg, #26A69A 0%, #7B1FA2 100%)"');
  color: white;
  box-shadow: v-bind('isDarkTheme ? "0 8px 32px rgba(0, 0, 0, 0.3)" : "0 8px 32px rgba(0, 0, 0, 0.2)"');
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.banner-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-image: url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M11 18c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm48 25c3.866 0 7-3.134 7-7s-3.134-7-7-7-7 3.134-7 7 3.134 7 7 7zm-43-7c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm63 31c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM34 90c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zm56-76c1.657 0 3-1.343 3-3s-1.343-3-3-3-3 1.343-3 3 1.343 3 3 3zM12 86c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm28-65c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm23-11c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-6 60c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm29 22c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zM32 63c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm57-13c2.76 0 5-2.24 5-5s-2.24-5-5-5-5 2.24-5 5 2.24 5 5 5zm-9-21c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM60 91c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM35 41c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2zM12 60c1.105 0 2-.895 2-2s-.895-2-2-2-2 .895-2 2 .895 2 2 2z' fill='rgba(255,255,255,.1)' fill-rule='evenodd'/%3E%3C/svg%3E");
  opacity: 0.5;
}

.position-relative {
  position: relative;
  z-index: 1;
}

.banner-content {
  max-width: 600px;
  padding: 16px 0;
}

.banner-image {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.gap-3 {
  gap: 12px;
}

@media (max-width: 768px) {
  .welcome-banner {
    padding: 16px 0;
  }
  
  .banner-content {
    text-align: center;
  }
  
  .d-flex.flex-wrap {
    justify-content: center;
  }
}
</style>
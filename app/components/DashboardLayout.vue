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
    
    <!-- Metric cards removed as requested -->
    
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
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
  isDarkTheme: {
    type: Boolean,
    default: false
  }
});
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
  font-weight: 700;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
  position: relative;
  z-index: 2;
  color: v-bind('isDarkTheme ? "#FFFFFF" : "#333333"') !important;
}

.custom-date-badge {
  display: inline-flex;
  align-items: center;
  background-color: v-bind('isDarkTheme ? "#000000" : "#FFFFFF"');
  color: v-bind('isDarkTheme ? "#FFFFFF" : "#333333"');
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
  color: v-bind('isDarkTheme ? "#FFFFFF" : "#333333"');
  font-weight: 700;
  text-shadow: v-bind('isDarkTheme ? "0 1px 2px rgba(0, 0, 0, 0.8)" : "none"');
  letter-spacing: 0.5px;
  font-size: 0.9rem;
}
</style>
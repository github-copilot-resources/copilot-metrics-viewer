<template>
  <div class="loading-container">
    <div class="loading-content">
      <div class="loading-icon">
        <v-icon color="primary" size="x-large" class="pulse-icon">mdi-github</v-icon>
        <div class="loading-circle"></div>
      </div>
      <p class="loading-text mt-4">{{ message }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  message: {
    type: String,
    default: 'Loading data...'
  }
});
</script>

<style scoped>
.loading-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  width: 100%;
}

.loading-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading-icon {
  position: relative;
  width: 64px;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-circle {
  position: absolute;
  width: 100%;
  height: 100%;
  border: 3px solid rgba(63, 81, 181, 0.2);
  border-top: 3px solid var(--v-theme-primary);
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
}

.pulse-icon {
  animation: pulse 2s infinite;
}

.loading-text {
  font-size: 1rem;
  color: var(--v-theme-on-surface-variant);
  font-weight: 500;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes pulse {
  0% { opacity: 0.6; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.1); }
  100% { opacity: 0.6; transform: scale(0.9); }
}
</style>
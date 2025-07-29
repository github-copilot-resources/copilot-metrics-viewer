<template>
  <div class="loading-container">
    <div class="loading-content">
      <div class="loading-icon">
        <v-icon color="secondary" size="x-large" class="pulse-icon">mdi-github</v-icon>
        <div class="loading-circle"></div>
        <div class="loading-glow"></div>
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
  border: 3px solid rgba(139, 233, 253, 0.1);
  border-top: 3px solid #8BE9FD;
  border-right: 3px solid #64D8CB;
  border-bottom: 3px solid #9C64D8;
  border-radius: 50%;
  animation: spin 1.5s linear infinite;
  box-shadow: 0 0 15px rgba(139, 233, 253, 0.2);
}

.loading-glow {
  position: absolute;
  width: 150%;
  height: 150%;
  background: radial-gradient(circle, rgba(139, 233, 253, 0.2) 0%, rgba(139, 233, 253, 0) 70%);
  animation: glow 3s ease-in-out infinite;
}

.pulse-icon {
  animation: pulse 2s infinite;
  filter: drop-shadow(0 0 8px rgba(139, 233, 253, 0.6));
}

.loading-text {
  font-size: 1.1rem;
  background: linear-gradient(90deg, #8BE9FD, #64D8CB, #9C64D8);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-weight: 500;
  letter-spacing: 0.5px;
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

@keyframes glow {
  0% { opacity: 0.3; transform: scale(0.8); }
  50% { opacity: 0.6; transform: scale(1.1); }
  100% { opacity: 0.3; transform: scale(0.8); }
}
</style>
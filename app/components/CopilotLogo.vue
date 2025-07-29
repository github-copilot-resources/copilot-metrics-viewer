<template>
  <div class="copilot-logo">
    <div class="logo-container">
      <div class="logo-icon">
        <v-icon size="x-large" class="logo-face">mdi-robot</v-icon>
        <div class="glow-effect"></div>
      </div>
    </div>
    <div v-if="showText" class="logo-text">
      <span class="text-gradient">Copilot Metrics</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps({
  showText: {
    type: Boolean,
    default: true
  }
});
</script>

<style scoped>
.copilot-logo {
  display: flex;
  align-items: center;
}

.logo-container {
  position: relative;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-icon {
  position: relative;
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, #64D8CB 0%, #9C64D8 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 15px rgba(139, 233, 253, 0.5);
  animation: pulse 3s infinite;
}

.logo-face {
  color: white;
  filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.5));
}

.glow-effect {
  position: absolute;
  top: -5px;
  left: -5px;
  right: -5px;
  bottom: -5px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(139, 233, 253, 0.4) 0%, rgba(139, 233, 253, 0) 70%);
  z-index: -1;
  animation: glow 3s infinite alternate;
}

.logo-text {
  margin-left: 12px;
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.text-gradient {
  color: #9C64D8 !important; /* Dark purple from the site's color palette */
  -webkit-text-fill-color: #9C64D8; /* Ensure the color is applied in webkit browsers */
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  font-weight: 800;
  letter-spacing: 0.5px;
}

@keyframes pulse {
  0% { transform: scale(1); }
  50% { transform: scale(1.05); }
  100% { transform: scale(1); }
}

@keyframes glow {
  0% { opacity: 0.5; }
  100% { opacity: 0.8; }
}
</style>
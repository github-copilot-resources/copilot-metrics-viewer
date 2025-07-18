<template>
  <div class="theme-toggle">
    <v-btn
      icon
      variant="text"
      :color="isDarkTheme ? 'white' : 'primary'"
      @click="toggleTheme"
      class="theme-toggle-button"
    >
      <div class="toggle-icon-container">
        <v-icon
          class="toggle-icon sun"
          :class="{ 'active': !isDarkTheme }"
        >
          mdi-weather-sunny
        </v-icon>
        <v-icon
          class="toggle-icon moon"
          :class="{ 'active': isDarkTheme }"
        >
          mdi-weather-night
        </v-icon>
      </div>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
const props = defineProps({
  isDarkTheme: {
    type: Boolean,
    required: true
  }
});

const emit = defineEmits(['toggle']);

function toggleTheme() {
  emit('toggle');
}
</script>

<style scoped>
.theme-toggle {
  position: relative;
}

.theme-toggle-button {
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;
}

.toggle-icon-container {
  position: relative;
  width: 24px;
  height: 24px;
}

.toggle-icon {
  position: absolute;
  top: 0;
  left: 0;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  opacity: 0;
  transform: scale(0.5) rotate(-30deg);
}

.toggle-icon.active {
  opacity: 1;
  transform: scale(1) rotate(0);
}

.sun {
  color: #FFC107;
}

.moon {
  color: #E0E0E0;
}
</style>
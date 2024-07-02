<template>
  <v-container>
      <!-- Displaying the JSON object -->
      <v-card max-height="575px" class="overflow-y-auto">
          <pre ref="jsonText">{{ JSON.stringify(metrics, null, 2) }}</pre>
      </v-card>
      <br>
      <div class="copy-container">
        <v-btn @click="copyToClipboard">Copy to Clipboard</v-btn>
        <transition name="fade">
          <div v-if="showCopyMessage" :class="{'copy-message': true, 'error': isError}">{{ message }}</div>
        </transition>
      </div>
      
      <br><br>
  
      <v-card max-height="575px" class="overflow-y-auto">
          <pre ref="jsonText">{{ JSON.stringify(seats, null, 2) }}</pre>
      </v-card>
      <br>
      <div class="copy-container">
        <v-btn @click="showSeatCount">Show Assigned Seats count</v-btn>
        <transition name="fade">
          <div v-if="showSeatMessage" :class="{'copy-message': true, 'error': isError}">{{ message }}</div>
        </transition>
      </div>
  </v-container>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

export default defineComponent({
  name: 'ApiResponse',
  props: {
      metrics: {
          type: Object,
          required: true
      },
      seats: {
          type: Array,
          required: true
      }
  },
  data() {
    return {
      vueAppScope: process.env.VUE_APP_SCOPE,
      showCopyMessage: false,
      showSeatMessage: false,
      isError: false,
      message : ''
      
    };
  },
  methods: {
  copyToClipboard() {
    const jsonText = this.$refs.jsonText as HTMLElement;
    navigator.clipboard.writeText(jsonText.innerText)
      .then(() => {
        this.message = 'Copied to clipboard!';
        this.isError = false;
      })
      .catch(err => {
        this.message = 'Could not copy text!';
        this.isError = true;
        console.error('Could not copy text: ', err);
      });

    this.showCopyMessage = true;
      setTimeout(() => {
        this.showCopyMessage = false;
      }, 3000);
  },
  
  showSeatCount() {
    const seatCount = this.seats.length;
    //console.log('Seat count:', seatCount);
    this.message = `Seat count: ${seatCount}`;

    this.showSeatMessage = true;
    setTimeout(() => {
      this.showSeatMessage = false;
    }, 3000);
  }

  }

});
</script>

<style scoped>
.tiles-container {
  display: flex;
  justify-content: flex-start;
  flex-wrap: wrap;
}
.copy-container {
  display: flex;
  align-items: center;
}
.copy-message {
  margin-left: 10px;
  font-family: Roboto, sans-serif;
}
.copy-message.error {
  color: red;
}
.copy-message:not(.error) {
  color: darkgreen;
}
.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter, .fade-leave-to {
  opacity: 0;
}
</style>
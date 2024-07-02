<template>
  <v-container>
      <!-- Displaying the JSON object -->
      <v-card max-height="575px" class="overflow-y-auto">
          <pre ref="metricsJsonText">{{ JSON.stringify(metrics, null, 2) }}</pre>
      </v-card>
      <br>
      <div class="copy-container">
        <v-btn @click="copyToClipboard">Copy to Clipboard</v-btn>
        <transition name="fade">
          <div v-if="showCopyMessage" :class="{'copy-message': true, 'error': isError}">{{ message }}</div>
        </transition>
      </div>
      <br>
      <div class="copy-container">
        <v-btn @click="checkDataQuality">Check Data Quality</v-btn>
        <transition name="fade">
          <div v-if="showDataMessage" :class="{'copy-message': true, 'error': isError}">{{ message }}</div>
        </transition>
      </div>
      
      <br><br>
  
      <v-card max-height="575px" class="overflow-y-auto">
          <pre ref="seatsJsonText">{{ JSON.stringify(seats, null, 2) }}</pre>
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
import { Metrics } from '../model/Metrics';
import { CopilotUsageChecker } from '../api/CopilotUsageChecker';



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
      showDataMessage: false,
      isError: false,
      message : ''
      
    };
  },
  methods: {
  copyToClipboard() {
    const jsonText = this.$refs.metricsJsonText as HTMLElement;
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

  checkDataQuality() {
    const jsonText = this.$refs.metricsJsonText as HTMLElement;
    const metrics = jsonText.innerText || '';
    //check the data quality by using the CopilotUsageChecker
    console.log('Checking data quality...');
    console.log(jsonText.innerText);

    // just return here, for test purposes
    //return;
    
    try {
      const copilotUsageChecker = new CopilotUsageChecker(metrics);
      const { missingDates, emptyBreakdowns, zeroActivityDays,hasDataIssues } = copilotUsageChecker.runChecks();
      if (!hasDataIssues) {
        this.message = 'Data quality is good!';
        this.isError = false;
      } else {
        this.message = 'Data quality is bad!';
        if (missingDates.length > 0) {
          this.message += ` Missing dates: ${missingDates.length}, Dates: ${missingDates.join(', ')};`;
        }
        if (emptyBreakdowns.length > 0) {
          this.message += ` Empty breakdowns: ${emptyBreakdowns.length}, Days: ${emptyBreakdowns.join(', ')};`;
        }
        if (zeroActivityDays.length > 0) {
          this.message += ` Zero activity days: ${zeroActivityDays.length}, Days: ${zeroActivityDays.join(', ')}`;
        }
        
        this.isError = true;
        console.log("Missing dates:", missingDates);
        console.log("Days with empty breakdowns:", emptyBreakdowns);
        console.log("Days with zero activity:", zeroActivityDays);
      }
    } catch (error) {
      this.message = 'An error occurred while checking data quality!';
      this.isError = true;
      console.error('Error checking data quality:', error);
    }

    this.showDataMessage = true;
      setTimeout(() => {
        this.showDataMessage = false;
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
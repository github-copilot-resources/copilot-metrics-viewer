<template>
  <v-container>
    <div class="copy-container">
      <v-btn @click="checkMetricsDataQuality">Check Metric data quality</v-btn>
      <v-spacer/>
      <v-btn @click="copyToClipboard('metricsJsonText')">Copy Metrics to Clipboard</v-btn>
      <v-btn color="primary" @click="downloadMetricsCSV">Download CSV (Summary)</v-btn>
      <v-btn color="secondary" @click="downloadFullMetricsCSV">Download CSV (Full)</v-btn>
    </div>
    <transition name="fade">
      <div v-if="showQualityMessage || showCopyMessage || showSeatMessage" :class="{'copy-message': true, 'error': isError}">{{ message }}</div>
    </transition>
      <br><br>

      <!-- Displaying the JSON object -->
      <v-card max-height="575px" class="overflow-y-auto">
          <pre ref="metricsJsonText">{{ JSON.stringify(originalMetrics, null, 2) }}</pre>
      </v-card>
      <br>
      
      <div class="copy-container">
        <v-btn @click="showSeatCount">Show Assigned Seats count</v-btn>
        <transition name="fade">
          <div v-if="showSeatMessage" :class="{'copy-message': true, 'error': isError}">{{ message }}</div>
        </transition>
      </div>

      <v-card max-height="575px" class="overflow-y-auto">
          <pre ref="seatJsonText">{{ JSON.stringify(seats, null, 2) }}</pre>
      </v-card>
      <br>
  </v-container>
</template>

<script lang="ts">
import { defineComponent, toRaw } from 'vue';
import { MetricsValidator } from '@/model/MetricsValidator';
import { convertMetricsToCSV, convertCopilotMetricsToCSV, downloadCSV } from '@/utils/csvExport';
import type { CopilotMetrics } from '@/model/Copilot_Metrics';
import type { Metrics } from '@/model/Metrics';

export default defineComponent({
  name: 'ApiResponse',
  props: {
    originalMetrics: {
      type: Array as () => CopilotMetrics[],
      required: true
    },
    metrics: {
      type: Array as () => Metrics[],
      required: true
    },
    seats: {
      type: Array,
      required: true
    }
  },
  data() {
    return {
      showCopyMessage: false,
      showSeatMessage: false,
      showQualityMessage: false,
      isError: false,
      message: '',
      qualityMessage: ''
    };
  },
  methods: {
    copyToClipboard(refName: string) {
      const jsonText = this.$refs[refName] as HTMLElement;
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
    },

    checkMetricsDataQuality() {
      // Convert reactive proxy to raw object using Vue's toRaw
      const rawOriginalMetrics = toRaw(this.originalMetrics) as CopilotMetrics[];
      const validator = new MetricsValidator(rawOriginalMetrics);
    
     // console.log(validator);
      // create a new MetricsValidator object
      // check all the metrics
      const results = validator.checkAllMetrics();
      //console.log(results);
      // check if all the metrics are valid
      const allValid = Object.values(results).every((result: any) => result.length === 0);

      if (allValid) {
        this.message = 'All metrics are valid!';
        this.isError = false;
      } else {
        this.message = 'Some metrics might be inconsistent, please double check the API response.\n';
        this.isError = true;
        let typeCounter = 1;
        for (const [key, value] of Object.entries(results)) {
          if (value.length > 0) {
            this.message += `\n${typeCounter}).  ${key}:\n${JSON.stringify(value, null, 2)}\n`;
            typeCounter++;
          }
        }
      }

      this.showQualityMessage = true;
      setTimeout(() => {
        this.showQualityMessage = false;
      }, 6000);
    },

    downloadMetricsCSV() {
      try {
        // Convert reactive proxy to raw object using Vue's toRaw
        const rawMetrics = toRaw(this.metrics) as Metrics[];
        const csvContent = convertMetricsToCSV(rawMetrics);
        if (csvContent) {
          const currentDate = new Date().toISOString().split('T')[0];
          const filename = `copilot-metrics-summary-${currentDate}.csv`;
          downloadCSV(csvContent, filename);
          this.message = 'Summary CSV file downloaded successfully!';
          this.isError = false;
        } else {
          this.message = 'No metrics data available to export.';
          this.isError = true;
        }
      } catch (error) {
        this.message = 'Error generating CSV file.';
        this.isError = true;
        console.error('Error generating CSV:', error);
      }

      this.showCopyMessage = true;
      setTimeout(() => {
        this.showCopyMessage = false;
      }, 3000);
    },

    downloadFullMetricsCSV() {
      try {
        // Convert reactive proxy to raw object using Vue's toRaw
        const rawMetrics = toRaw(this.originalMetrics) as CopilotMetrics[];
        const csvContent = convertCopilotMetricsToCSV(rawMetrics);
        if (csvContent) {
          const currentDate = new Date().toISOString().split('T')[0];
          const filename = `copilot-metrics-full-${currentDate}.csv`;
          downloadCSV(csvContent, filename);
          this.message = 'Full CSV file downloaded successfully!';
          this.isError = false;
        } else {
          this.message = 'No metrics data available to export.';
          this.isError = true;
        }
      } catch (error) {
        this.message = 'Error generating CSV file.';
        this.isError = true;
        console.error('Error generating CSV:', error);
      }

      this.showCopyMessage = true;
      setTimeout(() => {
        this.showCopyMessage = false;
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
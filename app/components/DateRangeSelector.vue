<template>
  <v-card class="date-range-selector" elevation="2">
    <v-card-title class="d-flex align-center pb-2">
      <v-icon color="secondary" class="mr-2">mdi-calendar-range</v-icon>
      <span class="text-h6 text-secondary">Date Range Filter</span>
    </v-card-title>
    
    <v-divider class="mb-4" color="rgba(139, 233, 253, 0.2)"></v-divider>
    
    <v-row align="end">
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model="fromDate"
          label="From Date"
          type="date"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-calendar-start"
          color="secondary"
          :bg-color="$vuetify.theme.global.name === 'dark' ? 'rgba(139, 233, 253, 0.05)' : 'rgba(38, 166, 154, 0.05)'"
          @update:model-value="updateFromDate"
          :max="maxFromDate"
          :min="minFromDate"
          hide-details
          class="date-field"
        >
          <template v-slot:message>
            <span v-if="fromDateMessage" class="date-message">{{ fromDateMessage }}</span>
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model="toDate"
          label="To Date"
          type="date"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-calendar-end"
          color="secondary"
          :bg-color="$vuetify.theme.global.name === 'dark' ? 'rgba(139, 233, 253, 0.05)' : 'rgba(38, 166, 154, 0.05)'"
          @update:model-value="updateToDate"
          :max="maxToDate"
          :min="minToDate"
          hide-details
          class="date-field"
        >
          <template v-slot:message>
            <span v-if="toDateMessage" class="date-message">{{ toDateMessage }}</span>
          </template>
        </v-text-field>
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-checkbox
          v-model="excludeHolidays"
          label="Exclude holidays"
          density="comfortable"
          color="accent"
          hide-details
        >
          <template v-slot:label>
            <div class="d-flex align-center">
              <span>Exclude holidays</span>
              <v-tooltip location="top">
                <template v-slot:activator="{ props }">
                  <v-icon
                    v-bind="props"
                    size="small"
                    class="ml-1"
                  >
                    mdi-information-outline
                  </v-icon>
                </template>
                <span>Exclude weekends and holidays from metrics calculation</span>
              </v-tooltip>
            </div>
          </template>
        </v-checkbox>
      </v-col>
      <v-col cols="12" sm="6" md="3" class="d-flex flex-column">
        <div class="d-flex justify-end">
          <v-btn
            color="primary"
            variant="flat"
            size="large"
            class="mr-3 days-28-button"
            prepend-icon="mdi-refresh"
            @click="resetToDefault"
          >
            Last 28 Days
          </v-btn>
          <v-btn
            color="primary"
            size="large"
            :loading="loading"
            prepend-icon="mdi-check"
            @click="applyDateRange"
            class="apply-button"
            :disabled="!!dateRangeError"
          >
            Apply
          </v-btn>
        </div>
        <div v-if="dateRangeError" class="error-message text-right mt-2">{{ dateRangeError }}</div>
      </v-col>
    </v-row>

    <v-card-text class="pt-4">
      <v-chip
        color="secondary"
        variant="outlined"
        size="large"
        class="font-weight-medium date-chip"
      >
        <v-icon start color="secondary">mdi-information-outline</v-icon>
        {{ dateRangeText }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'

interface Props {
  loading?: boolean
}

interface Emits {
  (e: 'date-range-changed', value: { 
    since?: string; 
    until?: string; 
    description: string;
    excludeHolidays?: boolean;
  }): void
}

withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

// Calculate default dates (last 28 days)
const today = new Date()
const defaultFromDate = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000) // 27 days ago to include today

const fromDate = ref(formatDate(defaultFromDate))
const toDate = ref(formatDate(today))
const excludeHolidays = ref(false)
const fromDateMessage = ref('')
const toDateMessage = ref('')

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || ''
}

function parseDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z')
}

const dateRangeError = ref('');

// Calculate min/max dates to enforce 90-day limit
const maxFromDate = computed(() => {
  if (!toDate.value) return ''
  
  // From date can't be later than the to date
  return toDate.value
})

const minFromDate = computed(() => {
  if (!toDate.value) return ''
  
  // Calculate the earliest allowed "from date" based on the 90-day limit
  const to = parseDate(toDate.value)
  const earliestDate = new Date(to)
  earliestDate.setDate(to.getDate() - 89) // 90 days including the to date
  return formatDate(earliestDate)
})

const maxToDate = computed(() => {
  if (!fromDate.value) return ''
  
  // Calculate the latest allowed "to date" based on the 90-day limit
  const from = parseDate(fromDate.value)
  const latestDate = new Date(from)
  latestDate.setDate(from.getDate() + 89) // 90 days including the from date
  return formatDate(latestDate)
})

const minToDate = computed(() => {
  if (!fromDate.value) return ''
  
  // To date can't be earlier than the from date
  return fromDate.value
})

// Calculate the earliest allowed "from date" based on the selected "to date" and 90-day limit
const earliestFromDate = computed(() => {
  if (!toDate.value) return ''
  
  const to = parseDate(toDate.value)
  const earliestDate = new Date(to)
  earliestDate.setDate(to.getDate() - 89) // 90 days including the to date
  return formatDate(earliestDate)
})

// Calculate the latest allowed "to date" based on the selected "from date" and 90-day limit
const latestToDate = computed(() => {
  if (!fromDate.value) return ''
  
  const from = parseDate(fromDate.value)
  const latestDate = new Date(from)
  latestDate.setDate(from.getDate() + 89) // 90 days including the from date
  return formatDate(latestDate)
})

const dateRangeText = computed(() => {
  if (!fromDate.value || !toDate.value) {
    return 'Select date range'
  }
  
  const from = parseDate(fromDate.value)
  const to = parseDate(toDate.value)
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const withoutHolidays = excludeHolidays.value ? ' (excluding holidays/weekends)' : ''

  // Check if date range exceeds 90 days
  if (diffDays > 90) {
    dateRangeError.value = 'Date range cannot exceed 90 days';
    return `Date range too large: ${diffDays} days (maximum: 90 days)`;
  } else {
    dateRangeError.value = '';
  }

  if (diffDays === 1) {
    return `For ${from.toLocaleDateString()}${withoutHolidays}`
  } else if (diffDays <= 28 && isLast28Days()) {
    return `Over the last 28 days ${withoutHolidays}`
  } else {
    return `From ${from.toLocaleDateString()} to ${to.toLocaleDateString()} (${diffDays} days)${withoutHolidays}`
  }
})

function isLast28Days(): boolean {
  if (!fromDate.value || !toDate.value) return false
  
  const today = new Date()
  const expectedFromDate = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000)
  
  const from = parseDate(fromDate.value)
  const to = parseDate(toDate.value)
  
  return (
    from.toDateString() === expectedFromDate.toDateString() &&
    to.toDateString() === today.toDateString()
  )
}

function updateFromDate() {
  if (fromDate.value && toDate.value) {
    const from = parseDate(fromDate.value)
    const to = parseDate(toDate.value)
    
    // Calculate the difference in days
    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // If the from date is after the to date, adjust the to date
    if (from > to) {
      toDate.value = fromDate.value
    }
    
    // Show a helpful message about the date range limit
    if (diffDays > 80) {
      const daysLeft = 90 - diffDays
      fromDateMessage.value = daysLeft <= 0 ? 
        'Maximum range reached' : 
        `${daysLeft} days left in range limit`
    } else {
      fromDateMessage.value = ''
    }
    
    dateRangeError.value = ''
  }
}

function updateToDate() {
  if (fromDate.value && toDate.value) {
    const from = parseDate(fromDate.value)
    const to = parseDate(toDate.value)
    
    // Calculate the difference in days
    const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
    
    // If the to date is before the from date, adjust the from date
    if (to < from) {
      fromDate.value = toDate.value
    }
    
    // Show a helpful message about the date range limit
    if (diffDays > 80) {
      const daysLeft = 90 - diffDays
      toDateMessage.value = daysLeft <= 0 ? 
        'Maximum range reached' : 
        `${daysLeft} days left in range limit`
    } else {
      toDateMessage.value = ''
    }
    
    dateRangeError.value = ''
  }
}

function updateDateRange() {
  if (fromDate.value && toDate.value) {
    updateFromDate()
    updateToDate()
  }
}

function resetToDefault() {
  const today = new Date()
  const defaultFrom = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000)
  
  fromDate.value = formatDate(defaultFrom)
  toDate.value = formatDate(today)
}

function applyDateRange() {
  if (!fromDate.value || !toDate.value) {
    return
  }
  
  const from = parseDate(fromDate.value)
  const to = parseDate(toDate.value)
  
  if (from > to) {
    // Swap dates if from is after to
    const temp = fromDate.value
    fromDate.value = toDate.value
    toDate.value = temp
  }
  
  // Calculate the difference in days
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  
  // Check if date range exceeds 90 days
  if (diffDays > 90) {
    dateRangeError.value = 'Date range cannot exceed 90 days'
    return // Don't emit the update if the range is invalid
  }
  
  // Emit the date range change with holiday options
  emit('date-range-changed', {
    since: fromDate.value,
    until: toDate.value,
    description: dateRangeText.value,
    excludeHolidays: excludeHolidays.value,
  })
}

// Initialize with default range on mount
onMounted(() => {
  applyDateRange()
})
</script>

<style scoped>
.date-range-selector {
  border-radius: var(--border-radius-md);
  transition: all var(--transition-speed);
  background-color: v-bind('$vuetify.theme.global.name === "dark" ? "rgba(18, 18, 18, 0.8)" : "rgba(255, 255, 255, 0.8)"') !important;
  border: 1px solid v-bind('$vuetify.theme.global.name === "dark" ? "rgba(139, 233, 253, 0.1)" : "rgba(38, 166, 154, 0.1)"');
  backdrop-filter: blur(10px);
}

.date-range-selector:hover {
  box-shadow: v-bind('$vuetify.theme.global.name === "dark" ? "0 8px 24px rgba(100, 216, 203, 0.15)" : "0 8px 24px rgba(38, 166, 154, 0.15)"') !important;
  border: 1px solid v-bind('$vuetify.theme.global.name === "dark" ? "rgba(139, 233, 253, 0.2)" : "rgba(38, 166, 154, 0.2)"');
}

.date-field :deep(.v-field__input) {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#8BE9FD" : "#333333"') !important;
  font-weight: 500;
}

.date-field :deep(.v-field__outline) {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "rgba(139, 233, 253, 0.2)" : "rgba(38, 166, 154, 0.3)"') !important;
}

.date-field :deep(.v-field__outline__start),
.date-field :deep(.v-field__outline__end),
.date-field :deep(.v-field__outline__notch) {
  border-color: v-bind('$vuetify.theme.global.name === "dark" ? "rgba(139, 233, 253, 0.2)" : "rgba(38, 166, 154, 0.3)"') !important;
}

.date-field:hover :deep(.v-field__outline__start),
.date-field:hover :deep(.v-field__outline__end),
.date-field:hover :deep(.v-field__outline__notch) {
  border-color: v-bind('$vuetify.theme.global.name === "dark" ? "rgba(139, 233, 253, 0.4)" : "rgba(38, 166, 154, 0.5)"') !important;
}

.date-field :deep(.v-field__prepend-inner) {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#8BE9FD" : "#26A69A"') !important;
}

.date-field :deep(.v-label) {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "rgba(255, 255, 255, 0.7)" : "rgba(0, 0, 0, 0.7)"') !important;
}

.date-chip {
  background: transparent !important;
  border: 1px solid v-bind('$vuetify.theme.global.name === "dark" ? "rgba(139, 233, 253, 0.3)" : "rgba(38, 166, 154, 0.3)"') !important;
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#8BE9FD" : "#26A69A"') !important;
}

.apply-button {
  background-color: v-bind('$vuetify.theme.global.name === "dark" ? "#1976D2" : "#26A69A"') !important;
  color: white !important;
  font-weight: 600 !important;
  box-shadow: v-bind('$vuetify.theme.global.name === "dark" ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "0 2px 8px rgba(0, 0, 0, 0.15)"') !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  text-shadow: v-bind('$vuetify.theme.global.name === "dark" ? "0 1px 2px rgba(0, 0, 0, 0.5)" : "none"');
}

.days-28-button {
  background-color: v-bind('$vuetify.theme.global.name === "dark" ? "#0D47A1" : "#00897B"') !important;
  color: white !important;
  font-weight: 600 !important;
  box-shadow: v-bind('$vuetify.theme.global.name === "dark" ? "0 2px 8px rgba(0, 0, 0, 0.3)" : "0 2px 8px rgba(0, 0, 0, 0.15)"') !important;
  border: 1px solid rgba(255, 255, 255, 0.2) !important;
  text-shadow: v-bind('$vuetify.theme.global.name === "dark" ? "0 1px 2px rgba(0, 0, 0, 0.5)" : "none"');
}

.error-message {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#FF5252" : "#F44336"');
  font-size: 0.8rem;
  font-weight: 500;
}

.date-message {
  color: v-bind('$vuetify.theme.global.name === "dark" ? "#FFB86C" : "#FF9800"');
  font-size: 0.75rem;
  font-weight: 500;
  display: block;
  margin-top: 4px;
}

@keyframes pulse {
  0% { opacity: 0.8; }
  50% { opacity: 1; }
  100% { opacity: 0.8; }
}
</style>
<template>
  <v-card class="date-range-selector" elevation="2">
    <v-card-title class="d-flex align-center pb-2">
      <v-icon color="primary" class="mr-2">mdi-calendar-range</v-icon>
      <span class="text-h6">Date Range Filter</span>
    </v-card-title>
    
    <v-divider class="mb-4"></v-divider>
    
    <v-row align="end">
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model="fromDate"
          label="From Date"
          type="date"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-calendar-start"
          color="primary"
          @update:model-value="updateDateRange"
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-text-field
          v-model="toDate"
          label="To Date"
          type="date"
          variant="outlined"
          density="comfortable"
          prepend-inner-icon="mdi-calendar-end"
          color="primary"
          @update:model-value="updateDateRange"
          hide-details
        />
      </v-col>
      <v-col cols="12" sm="6" md="3">
        <v-checkbox
          v-model="excludeHolidays"
          label="Exclude holidays"
          density="comfortable"
          color="primary"
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
      <v-col cols="12" sm="6" md="3" class="d-flex align-center justify-end">
        <v-btn
          color="secondary"
          variant="tonal"
          size="large"
          class="mr-3"
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
        >
          Apply
        </v-btn>
      </v-col>
    </v-row>

    <v-card-text class="pt-4">
      <v-chip
        color="primary"
        variant="outlined"
        size="large"
        class="font-weight-medium"
      >
        <v-icon start>mdi-information-outline</v-icon>
        {{ dateRangeText }}
      </v-chip>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref } from 'vue'

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


function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || ''
}

function parseDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z')
}

const dateRangeText = computed(() => {
  if (!fromDate.value || !toDate.value) {
    return 'Select date range'
  }
  
  const from = parseDate(fromDate.value)
  const to = parseDate(toDate.value)
  const diffDays = Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  const withoutHolidays = excludeHolidays.value ? ' (excluding holidays/weekends)' : ''

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

function updateDateRange() {
  // This function is called when dates change, but we don't auto-apply
  // User needs to click Apply button
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
}

.date-range-selector:hover {
  box-shadow: var(--shadow-md) !important;
}
</style>
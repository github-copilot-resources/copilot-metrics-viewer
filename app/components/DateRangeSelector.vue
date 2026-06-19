<template>
  <v-card class="pa-4 ma-4" elevation="2">
    <v-card-title class="text-h6 pb-2">Date Range Filter</v-card-title>
    <v-row align="end">
      <v-col cols="6" sm="3">
        <v-text-field
          v-model="fromDate"
          label="From Date"
          type="date"
          variant="outlined"
          density="compact"
          :min="minDate"
          :max="maxDate"
          @update:model-value="updateDateRange"
        />
      </v-col>
      <v-col cols="6" sm="3">
        <v-text-field
          v-model="toDate"
          label="To Date"
          type="date"
          variant="outlined"
          density="compact"
          :min="minDate"
          :max="maxDate"
          @update:model-value="updateDateRange"
        />
      </v-col>
      <v-col cols="6" sm="2">
        <v-checkbox
          v-model="excludeHolidays"
          label="Exclude holidays from metrics"
          density="compact"
          @update:model-value="applyDateRange"
        />
      </v-col>
      <v-col cols="6" sm="4" class="d-flex align-center justify-start" style="padding-bottom: 35px;">
        <v-btn
          color="primary"
          variant="outlined"
          size="default"
          class="mr-3"
          @click="resetToDefault"
        >
          Last 28 Days
        </v-btn>
        <v-btn
          color="success"
          variant="outlined"
          size="default"
          :loading="loading"
          @click="applyDateRange"
        >
          Apply
        </v-btn>
      </v-col>
    </v-row>

    
    <v-card-text class="pt-2">
      <span class="text-caption text-medium-emphasis">
        {{ dateRangeText }}
      </span>
      <span v-if="availabilityText" class="text-caption text-medium-emphasis ml-2">
        · {{ availabilityText }}
      </span>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface Props {
  loading?: boolean
  /** Earliest date for which data is available (YYYY-MM-DD). */
  minDate?: string
  /** Latest date for which data is available (YYYY-MM-DD). */
  maxDate?: string
}

interface Emits {
  (e: 'date-range-changed', value: { 
    since?: string; 
    until?: string; 
    description: string;
    excludeHolidays?: boolean;
  }): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  minDate: undefined,
  maxDate: undefined,
})

const emit = defineEmits<Emits>()

/** Number of days in the default "last N days" window. */
const DEFAULT_WINDOW_DAYS = 28

const fromDate = ref('')
const toDate = ref('')
const excludeHolidays = ref(false)

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0] || ''
}

function parseDate(dateString: string): Date {
  return new Date(dateString + 'T00:00:00.000Z')
}

/**
 * Compute the default window: last 28 days ending at maxDate (or yesterday).
 * The picker's min/max bounds expose the broader available range, but the
 * dashboard always opens on the recent 28-day window so charts aren't dragged
 * down by months of historical data on first load.
 */
function computeDefaultRange(): { from: string; to: string } {
  const now = new Date()
  // Default "latest" is yesterday because the GH metrics API has ~1-day lag.
  const fallbackLatest = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const latest = props.maxDate ? parseDate(props.maxDate) : fallbackLatest
  const earliestCandidate = new Date(latest.getTime() - (DEFAULT_WINDOW_DAYS - 1) * 24 * 60 * 60 * 1000)
  const min = props.minDate ? parseDate(props.minDate) : earliestCandidate
  const earliest = earliestCandidate < min ? min : earliestCandidate
  return { from: formatDate(earliest), to: formatDate(latest) }
}

function applyDefaults() {
  const { from, to } = computeDefaultRange()
  fromDate.value = from
  toDate.value = to
}

applyDefaults()

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
  } else if (diffDays === DEFAULT_WINDOW_DAYS && isDefaultWindow()) {
    return `Over the last ${DEFAULT_WINDOW_DAYS} days ${withoutHolidays}`
  } else {
    return `From ${from.toLocaleDateString()} to ${to.toLocaleDateString()} (${diffDays} days)${withoutHolidays}`
  }
})

const availabilityText = computed(() => {
  if (!props.minDate || !props.maxDate) return ''
  const from = parseDate(props.minDate).toLocaleDateString()
  const to = parseDate(props.maxDate).toLocaleDateString()
  return `Data available: ${from} – ${to}`
})

function isDefaultWindow(): boolean {
  if (!fromDate.value || !toDate.value) return false
  const def = computeDefaultRange()
  return fromDate.value === def.from && toDate.value === def.to
}

function updateDateRange() {
  // This function is called when dates change, but we don't auto-apply
  // User needs to click Apply button
}

function resetToDefault() {
  applyDefaults()
}

/** Clamp a YYYY-MM-DD value into [minDate, maxDate]. */
function clamp(value: string): string {
  if (props.minDate && value < props.minDate) return props.minDate
  if (props.maxDate && value > props.maxDate) return props.maxDate
  return value
}

function applyDateRange() {
  if (!fromDate.value || !toDate.value) {
    return
  }
  
  // Clamp to available range
  fromDate.value = clamp(fromDate.value)
  toDate.value = clamp(toDate.value)

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

// Re-apply default if availability bounds arrive after mount and the user
// hasn't customised the range yet.
watch(
  () => [props.minDate, props.maxDate] as const,
  ([newMin, newMax], [oldMin, oldMax]) => {
    if (newMin === oldMin && newMax === oldMax) return
    applyDefaults()
    applyDateRange()
  }
)

// Initialize with default range on mount
onMounted(() => {
  applyDateRange()
})
</script>
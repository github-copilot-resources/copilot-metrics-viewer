<template>
  <v-card class="pa-4 ma-4" elevation="2">
    <v-card-title class="text-h6 pb-2">Date Range Filter</v-card-title>
    <v-row>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model="fromDate"
          label="From Date"
          type="date"
          variant="outlined"
          density="compact"
          @update:model-value="updateDateRange"
        />
      </v-col>
      <v-col cols="12" sm="4">
        <v-text-field
          v-model="toDate"
          label="To Date"
          type="date"
          variant="outlined"
          density="compact"
          @update:model-value="updateDateRange"
        />
      </v-col>
      <v-col cols="12" sm="4" class="d-flex align-end">
        <v-btn
          color="primary"
          variant="outlined"
          class="mr-2"
          @click="resetToDefault"
        >
          Last 28 Days
        </v-btn>
        <v-btn
          color="primary"
          :loading="props.loading"
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
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
interface Props {
  loading?: boolean
}

interface Emits {
  (e: 'date-range-changed', value: { since?: string; until?: string; description: string }): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

// Calculate default dates (last 28 days)
const today = new Date()
const defaultFromDate = new Date(today.getTime() - 27 * 24 * 60 * 60 * 1000) // 27 days ago to include today

const fromDate = ref(formatDate(defaultFromDate))
const toDate = ref(formatDate(today))

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
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
  
  if (diffDays === 1) {
    return `For ${from.toLocaleDateString()}`
  } else if (diffDays <= 28 && isLast28Days()) {
    return 'Over the last 28 days'
  } else {
    return `From ${from.toLocaleDateString()} to ${to.toLocaleDateString()} (${diffDays} days)`
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
  
  // Emit the date range change
  emit('date-range-changed', {
    since: fromDate.value,
    until: toDate.value,
    description: dateRangeText.value
  })
}

// Initialize with default range on mount
onMounted(() => {
  applyDateRange()
})
</script>
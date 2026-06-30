<template>
  <v-dialog v-model="isOpen" max-width="780" scrollable>
    <v-card>
      <v-card-title class="d-flex align-center ga-2">
        <v-icon color="primary">mdi-shield-crown</v-icon>
        Admin Panel
        <v-spacer />
        <v-btn icon variant="text" size="small" title="Close" @click="isOpen = false">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider />

      <v-card-text style="max-height: 70vh;">
        <!-- Action result toast (most recent) -->
        <v-alert
          v-if="actionResult"
          :type="actionResult.success ? 'success' : 'error'"
          variant="tonal"
          density="compact"
          closable
          class="mb-3"
          @click:close="actionResult = null"
        >
          {{ actionResult.message }}
        </v-alert>

        <!-- ── Section 1: Status ─────────────────────────────────────── -->
        <div class="text-overline mb-1">Status</div>
        <v-list density="compact" class="bg-transparent">
          <v-list-item>
            <template #prepend>
              <v-icon :color="overview?.db.connected ? 'success' : 'warning'">
                {{ overview?.db.connected ? 'mdi-database-check' : 'mdi-database-off' }}
              </v-icon>
            </template>
            <v-list-item-title>Database</v-list-item-title>
            <v-list-item-subtitle>
              <span v-if="overview?.db.connected">
                Connected ({{ overview.db.latencyMs }}ms)
              </span>
              <span v-else-if="overview?.mode === 'mock'">
                Not used — running in mock mode
              </span>
              <span v-else>
                {{ overview?.db.error || 'Unavailable' }}
              </span>
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon>mdi-cog-outline</v-icon>
            </template>
            <v-list-item-title>Mode</v-list-item-title>
            <v-list-item-subtitle>
              <v-chip size="x-small" :color="modeColor" class="text-uppercase">
                {{ overview?.mode || '—' }}
              </v-chip>
              <span class="ml-2 text-caption">v{{ overview?.version }} · uptime {{ formattedUptime }}</span>
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon>mdi-target</v-icon>
            </template>
            <v-list-item-title>Scope</v-list-item-title>
            <v-list-item-subtitle>
              {{ overview?.scope }} · {{ overview?.identifier || '—' }}
              <span v-if="overview?.teamSlug"> · team {{ overview.teamSlug }}</span>
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item>
            <template #prepend>
              <v-icon>mdi-calendar-range</v-icon>
            </template>
            <v-list-item-title>Data range</v-list-item-title>
            <v-list-item-subtitle>
              <span v-if="overview?.dataRange.earliest && overview?.dataRange.latest">
                {{ overview.dataRange.earliest }} → {{ overview.dataRange.latest }}
                ({{ overview.syncStats.syncedDays }}/{{ overview.syncStats.totalDays }} days synced,
                {{ overview.syncStats.missingDays }} missing)
              </span>
              <span v-else>No data</span>
            </v-list-item-subtitle>
          </v-list-item>

          <v-list-item v-if="overview && overview.db.connected">
            <template #prepend>
              <v-icon :color="overview.failedCount ? 'error' : 'medium-emphasis'">mdi-alert-circle</v-icon>
            </template>
            <v-list-item-title>Sync queue</v-list-item-title>
            <v-list-item-subtitle>
              {{ overview.pendingCount }} pending · {{ overview.failedCount }} failed
            </v-list-item-subtitle>
          </v-list-item>
        </v-list>

        <div class="d-flex justify-end mt-1">
          <v-btn
            size="small"
            variant="tonal"
            prepend-icon="mdi-refresh"
            :loading="loading"
            @click="refresh"
          >
            Refresh status
          </v-btn>
        </div>

        <v-divider class="my-3" />

        <!-- ── Section 2: Sync actions ───────────────────────────────── -->
        <div class="text-overline mb-2">Sync actions</div>

        <v-row dense>
          <v-col cols="12" sm="6">
            <v-btn
              block
              prepend-icon="mdi-cloud-download"
              :loading="busyAction === 'sync-last-28'"
              :disabled="!!busyAction"
              @click="runAction('sync-last-28')"
            >
              Sync last 28 days
            </v-btn>
          </v-col>
          <v-col cols="12" sm="6">
            <v-btn
              block
              prepend-icon="mdi-vector-arrange-below"
              :loading="busyAction === 'sync-gaps'"
              :disabled="!!busyAction || !gapForm.since || !gapForm.until"
              @click="runAction('sync-gaps', { since: gapForm.since, until: gapForm.until })"
            >
              Fill gaps in range
            </v-btn>
          </v-col>
        </v-row>

        <v-row dense class="mt-1">
          <v-col cols="6" sm="3">
            <v-text-field
              v-model="gapForm.since"
              label="Since"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="6" sm="3">
            <v-text-field
              v-model="gapForm.until"
              label="Until"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="6">
            <v-btn
              block
              prepend-icon="mdi-calendar-multiple"
              :loading="busyAction === 'sync-range'"
              :disabled="!!busyAction || !gapForm.since || !gapForm.until"
              @click="runAction('sync-range', { since: gapForm.since, until: gapForm.until })"
            >
              Sync every day in range
            </v-btn>
          </v-col>
        </v-row>

        <v-row dense class="mt-1">
          <v-col cols="6" sm="3">
            <v-text-field
              v-model="singleDate"
              label="Date"
              type="date"
              density="compact"
              variant="outlined"
              hide-details
            />
          </v-col>
          <v-col cols="12" sm="9">
            <v-btn
              block
              prepend-icon="mdi-calendar"
              :loading="busyAction === 'sync-date'"
              :disabled="!!busyAction || !singleDate"
              @click="runAction('sync-date', { date: singleDate })"
            >
              Sync single date
            </v-btn>
          </v-col>
        </v-row>

        <!-- ── Section 3: Failures ───────────────────────────────────── -->
        <template v-if="overview?.recentFailures?.length">
          <v-divider class="my-3" />
          <div class="d-flex align-center mb-2">
            <span class="text-overline">Recent failures ({{ overview.failedCount }})</span>
            <v-spacer />
            <v-btn
              size="small"
              variant="tonal"
              color="warning"
              prepend-icon="mdi-replay"
              :loading="busyAction === 'retry-failed'"
              :disabled="!!busyAction"
              @click="runAction('retry-failed')"
            >
              Retry all
            </v-btn>
            <v-btn
              size="small"
              variant="text"
              color="error"
              prepend-icon="mdi-delete-outline"
              class="ml-2"
              :loading="busyAction === 'clear-failed'"
              :disabled="!!busyAction"
              @click="runAction('clear-failed')"
            >
              Clear all
            </v-btn>
          </div>
          <v-table density="compact">
            <thead>
              <tr>
                <th>Date</th>
                <th>Error</th>
                <th>Attempts</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr v-for="f in overview.recentFailures" :key="f.metricsDate">
                <td><code>{{ f.metricsDate }}</code></td>
                <td style="max-width: 480px; white-space: pre-wrap; word-break: break-word;">{{ f.errorMessage || '—' }}</td>
                <td>{{ f.attemptCount }}</td>
                <td>
                  <v-btn
                    size="x-small"
                    variant="text"
                    icon
                    title="Retry this date"
                    :loading="retryingDate === f.metricsDate"
                    :disabled="!!busyAction"
                    @click="retryOne(f.metricsDate)"
                  >
                    <v-icon>mdi-replay</v-icon>
                  </v-btn>
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>

        <!-- ── Section 4: Billing CSV ingest ─────────────────────────── -->
        <template v-if="billingStatus !== null">
          <v-divider class="my-3" />
          <div class="d-flex align-center mb-2">
            <span class="text-overline">Billing CSV ingest</span>
            <v-chip
              v-if="billingStatus.inFlight"
              size="x-small"
              color="info"
              variant="tonal"
              class="ml-2"
            >
              {{ billingStatus.inFlight.status }}
            </v-chip>
            <v-spacer />
            <v-btn
              size="small"
              variant="tonal"
              color="primary"
              prepend-icon="mdi-cloud-download"
              :loading="busyAction === 'sync-billing-csv'"
              :disabled="!!busyAction || !!billingStatus.inFlight"
              @click="runAction('sync-billing-csv', { fillGapsOnly: billingForm.fillGapsOnly })"
            >
              Sync last 30 days
            </v-btn>
            <v-btn
              v-if="billingStatus.inFlight"
              size="small"
              variant="text"
              color="warning"
              prepend-icon="mdi-cancel"
              class="ml-2"
              :loading="busyAction === 'sync-billing-csv-cancel'"
              :disabled="busyAction === 'sync-billing-csv-cancel'"
              @click="runAction('sync-billing-csv-cancel')"
            >
              Cancel
            </v-btn>
          </div>

          <v-alert
            type="warning"
            variant="tonal"
            density="compact"
            class="mb-2"
            icon="mdi-clock-outline"
          >
            <strong>Heads up — this is a slow, costly operation.</strong>
            We ask GitHub to generate a billing CSV export job, poll until it's
            ready (typically <strong>1–5 minutes</strong>, but can be 10+ for
            wide windows or busy enterprises), then download and upsert every
            row. Windows wider than 31 days are split into multiple chunks
            (GitHub's per-export cap), each one a full request → poll →
            download cycle. The job runs server-side in the background — you
            can close this tab and check back later; the recent-jobs table
            below shows progress.
          </v-alert>

          <!-- Backfill range -->
          <v-row dense align="center" class="mb-1">
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="billingForm.since"
                label="Since (YYYY-MM-DD)"
                type="date"
                density="compact"
                hide-details
                :disabled="!!busyAction || !!billingStatus.inFlight"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-text-field
                v-model="billingForm.until"
                label="Until (YYYY-MM-DD)"
                type="date"
                density="compact"
                hide-details
                :disabled="!!busyAction || !!billingStatus.inFlight"
              />
            </v-col>
            <v-col cols="12" sm="4">
              <v-btn
                block
                size="small"
                variant="tonal"
                color="primary"
                prepend-icon="mdi-history"
                :loading="busyAction === 'sync-billing-csv-range'"
                :disabled="!!busyAction || !!billingStatus.inFlight || !billingForm.since || !billingForm.until"
                @click="runAction('sync-billing-csv-range', billingForm)"
              >
                Backfill range
              </v-btn>
            </v-col>
          </v-row>
          <v-row dense class="mb-2">
            <v-col cols="12">
              <v-checkbox
                v-model="billingForm.fillGapsOnly"
                label="Skip already-ingested ranges (fill gaps only)"
                density="compact"
                hide-details
                color="primary"
                :disabled="!!busyAction || !!billingStatus.inFlight"
              >
                <template #label>
                  <span>
                    Skip already-ingested ranges (fill gaps only)
                    <span class="text-caption text-medium-emphasis">
                      — saves time and GitHub export quota by only fetching
                      dates not yet in the database
                    </span>
                  </span>
                </template>
              </v-checkbox>
            </v-col>
          </v-row>

          <v-table v-if="billingStatus.recent?.length" density="compact">
            <thead>
              <tr>
                <th>Window</th>
                <th>Status</th>
                <th>Rows</th>
                <th>Triggered by</th>
                <th>Completed</th>
                <th>Error</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="j in billingStatus.recent" :key="j.id">
                <td><code>{{ j.startDate }}</code> → <code>{{ j.endDate }}</code></td>
                <td>
                  <v-chip
                    size="x-small"
                    :color="billingJobChipColor(j.status)"
                    variant="tonal"
                  >
                    {{ j.status }}
                  </v-chip>
                </td>
                <td>
                  <span
                    v-if="(j.chunksFetched && j.chunksFetched.length > 0) || (j.gapsSkipped && j.gapsSkipped.length > 0)"
                    style="cursor: help; border-bottom: 1px dotted currentColor;"
                    :title="formatJobBreakdown(j)"
                  >{{ j.rowsIngested }}</span>
                  <span v-else>{{ j.rowsIngested }}</span>
                </td>
                <td>{{ j.triggeredBy || '—' }}</td>
                <td>{{ j.completedAt ? new Date(j.completedAt).toLocaleString() : '—' }}</td>
                <td style="max-width: 360px;">
                  <span
                    v-if="j.errorMessage"
                    class="text-caption text-error"
                    style="white-space: pre-wrap; word-break: break-word;"
                    :title="j.errorMessage"
                  >{{ truncate(j.errorMessage, 200) }}</span>
                  <span v-else>—</span>
                </td>
                <td style="width: 40px;">
                  <v-btn
                    v-if="canDismissJob(j)"
                    icon="mdi-close"
                    size="x-small"
                    variant="text"
                    density="compact"
                    title="Dismiss this row (kept in DB so gap-mode coverage still works)"
                    @click="dismissBillingJob(j.id)"
                  />
                </td>
              </tr>
            </tbody>
          </v-table>
        </template>
      </v-card-text>

      <v-divider />

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="isOpen = false">Close</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'

interface Props {
  modelValue: boolean
  /** Identity params used to scope the overview / sync calls. */
  queryParams: Record<string, string>
}

interface Overview {
  db: { connected: boolean; latencyMs?: number; error?: string }
  mode: 'mock' | 'historical' | 'live'
  version: string
  uptimeSeconds: number
  scope: string
  identifier: string
  teamSlug?: string
  dataRange: { earliest: string | null; latest: string | null }
  syncStats: { totalDays: number; syncedDays: number; missingDays: number; missingDates: string[] }
  pendingCount: number
  failedCount: number
  recentFailures: Array<{ metricsDate: string; errorMessage?: string; attemptCount: number; lastAttemptAt?: string }>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'synced'): void
}>()

const isOpen = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const overview = ref<Overview | null>(null)
const loading = ref(false)
const busyAction = ref<string | null>(null)
const retryingDate = ref<string | null>(null)
const actionResult = ref<{ success: boolean; message: string } | null>(null)

const singleDate = ref('')
const gapForm = ref({ since: '', until: '' })
// Pre-fill the backfill window with a sensible default: last 30 days through
// today. Admins can still override either field, but this saves clicks for
// the common "ingest recent history" flow and makes the operation runnable
// in a single click after the gap-fill is unblocked.
function isoToday(): string {
  return new Date().toISOString().split('T')[0] || ''
}
function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - days)
  return d.toISOString().split('T')[0] || ''
}
const billingForm = ref({ since: isoDaysAgo(30), until: isoToday(), fillGapsOnly: true })

interface BillingCsvJob {
  id: number
  enterprise: string
  startDate: string
  endDate: string
  status: string
  rowsIngested: number
  triggeredBy: string | null
  completedAt: string | null
  errorMessage: string | null
  chunksFetched: Array<{ start: string; end: string }> | null
  gapsSkipped: Array<{ start: string; end: string }> | null
}

interface BillingStatus {
  inFlight: BillingCsvJob | null
  recent: BillingCsvJob[]
}

// `null` means "billing CSV not configured server-side, hide the section".
const billingStatus = ref<BillingStatus | null>(null)
let billingPollHandle: ReturnType<typeof setInterval> | null = null

function billingJobChipColor(status: string): string {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'error'
  if (status === 'cancelled') return 'warning'
  return 'info'
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + '…' : s
}

/**
 * Compose a hover tooltip explaining what a job actually fetched vs skipped.
 * Pure / cheap; reads only from the job row, no I/O.
 */
function formatJobBreakdown(j: BillingCsvJob): string {
  const lines: string[] = []
  if (j.chunksFetched && j.chunksFetched.length > 0) {
    lines.push('Fetched: ' + j.chunksFetched.map(r => `${r.start}..${r.end}`).join(', '))
  }
  if (j.gapsSkipped && j.gapsSkipped.length > 0) {
    lines.push('Skipped (already ingested): ' + j.gapsSkipped.map(r => `${r.start}..${r.end}`).join(', '))
  }
  return lines.join('\n')
}

async function loadBillingStatus() {
  try {
    const resp = await $fetch<{ billingCsv: BillingStatus | null }>('/api/admin/sync-status' + buildQuery())
    billingStatus.value = resp.billingCsv ?? null
  } catch {
    // Leave billingStatus alone on transient errors so the UI doesn't flicker.
  }
}

function startBillingPolling() {
  if (billingPollHandle) return
  billingPollHandle = setInterval(() => {
    if (!billingStatus.value?.inFlight) {
      stopBillingPolling()
      return
    }
    loadBillingStatus()
  }, 5000)
}

function stopBillingPolling() {
  if (billingPollHandle) {
    clearInterval(billingPollHandle)
    billingPollHandle = null
  }
}

watch(() => billingStatus.value?.inFlight, (inFlight) => {
  if (inFlight) startBillingPolling()
  else stopBillingPolling()
})

onUnmounted(stopBillingPolling)

const modeColor = computed(() => {
  switch (overview.value?.mode) {
    case 'historical': return 'primary'
    case 'live': return 'info'
    case 'mock': return 'warning'
    default: return undefined
  }
})

const formattedUptime = computed(() => {
  const s = overview.value?.uptimeSeconds ?? 0
  if (s < 60) return `${s}s`
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`
  return `${Math.floor(s / 86400)}d${Math.floor((s % 86400) / 3600)}h`
})

function buildQuery(extra?: Record<string, string>): string {
  const p = new URLSearchParams({ ...props.queryParams, ...(extra || {}) })
  return p.toString() ? '?' + p.toString() : ''
}

async function refresh() {
  loading.value = true
  try {
    overview.value = await $fetch<Overview>('/api/admin/overview' + buildQuery())
    // Pre-fill the gap-fill range with the available data range, if any.
    if (overview.value.dataRange.earliest && !gapForm.value.since) {
      gapForm.value.since = overview.value.dataRange.earliest
    }
    if (overview.value.dataRange.latest && !gapForm.value.until) {
      gapForm.value.until = overview.value.dataRange.latest
    }
    // Billing status is a separate endpoint; non-blocking.
    void loadBillingStatus()
  } catch (err) {
    actionResult.value = { success: false, message: `Failed to load overview: ${describeError(err)}` }
  } finally {
    loading.value = false
  }
}

function describeError(err: unknown): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { statusMessage?: string; message?: string } }).data
    if (data?.statusMessage) return data.statusMessage
    if (data?.message) return data.message
  }
  return err instanceof Error ? err.message : String(err)
}

async function runAction(action: string, extra?: Record<string, string | boolean | number>) {
  busyAction.value = action
  actionResult.value = null
  try {
    const body: Record<string, unknown> = { action, ...props.queryParams, ...(extra || {}) }
    const result = await $fetch<{ action: string; [k: string]: unknown }>('/api/admin/sync', {
      method: 'POST',
      body,
    })
    actionResult.value = { success: true, message: summarizeResult(result) }
    await refresh()
    emit('synced')
  } catch (err) {
    actionResult.value = { success: false, message: `${action} failed: ${describeError(err)}` }
  } finally {
    busyAction.value = null
  }
}

/**
 * A finished job (any non-in-flight status) can be hidden from the recent-jobs
 * table. In-flight jobs must be cancelled first via the "Cancel in-flight" button.
 */
function canDismissJob(j: BillingCsvJob): boolean {
  const inFlight = new Set(['queued', 'processing', 'downloading', 'upserting'])
  return !inFlight.has(j.status)
}

async function dismissBillingJob(jobId: number) {
  await runAction('sync-billing-csv-dismiss', { jobId })
  await loadBillingStatus()
}

async function retryOne(date: string) {
  retryingDate.value = date
  busyAction.value = 'retry-one'
  actionResult.value = null
  try {
    const body = { action: 'sync-date', date, ...props.queryParams }
    const result = await $fetch<{ result: { success: boolean; error?: string } }>('/api/admin/sync', {
      method: 'POST',
      body,
    })
    const ok = result.result?.success
    actionResult.value = {
      success: !!ok,
      message: ok ? `Re-synced ${date}` : `Retry failed for ${date}: ${result.result?.error || 'unknown error'}`,
    }
    await refresh()
    if (ok) emit('synced')
  } catch (err) {
    actionResult.value = { success: false, message: `Retry failed for ${date}: ${describeError(err)}` }
  } finally {
    retryingDate.value = null
    busyAction.value = null
  }
}

/** Build a short human-readable summary for the action toast. */
function summarizeResult(result: Record<string, unknown>): string {
  const a = result.action
  if (a === 'sync-last-28') {
    return `Bulk sync: ${result.savedDays}/${result.totalDays} days saved, ${result.skippedDays} skipped`
  }
  if (a === 'sync-range') {
    return `Range sync: ${result.successCount}/${result.totalDays} succeeded`
  }
  if (a === 'sync-gaps') {
    return `Gap fill: ${result.gapsFilled}/${result.gapsDetected} filled (${result.outsideWindow} via 1-day endpoint)`
  }
  if (a === 'sync-date') {
    const r = result.result as { success?: boolean; error?: string } | undefined
    return r?.success ? `Synced ${(r as { date?: string }).date}` : `Failed: ${r?.error || 'unknown error'}`
  }
  if (a === 'retry-failed') {
    return `Retried ${result.retried} failed sync(s): ${result.successCount} ok, ${result.failureCount} still failing`
  }
  if (a === 'clear-failed') {
    return `Cleared ${result.removed ?? 0} failed sync row(s)`
  }
  if (a === 'sync-billing-csv' || a === 'sync-billing-csv-range') {
    return `Billing CSV job ${result.jobId} queued (${result.startDate} → ${result.endDate})`
  }
  if (a === 'sync-billing-csv-cancel') {
    return `Cancelled ${result.cancelled ?? 0} in-flight billing CSV job(s)`
  }
  if (a === 'sync-billing-csv-dismiss') {
    return result.dismissed
      ? `Dismissed job ${result.jobId} from the recent-jobs list`
      : `Job ${result.jobId} not dismissed (already hidden, in-flight, or not found)`
  }
  return `Action ${a} completed`
}

// Auto-load when the dialog opens
watch(isOpen, (open) => {
  if (open && !overview.value) refresh()
})
</script>

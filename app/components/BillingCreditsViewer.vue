<template>
  <div>
    <v-card variant="outlined" class="mx-4 mt-3 mb-2 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">💳 AI Credit Billing</div>
          <div class="text-medium-emphasis">
            Aggregate breakdown of premium-request spend by model and SKU,
            sourced from the GitHub Billing API. Admin-only — restricted to
            the <code>NUXT_USAGE_ADMINS</code> allowlist.
          </div>
          <div class="text-caption text-medium-emphasis mt-1">
            Per-user attribution below comes from the <code>user</code> field on the
            enterprise billing endpoint when available.
          </div>
        </div>
        <div style="min-width: 200px;">
          <v-text-field
            v-model="selectedMonth"
            label="Billing month"
            type="month"
            density="compact"
            hide-details
            variant="outlined"
            prepend-inner-icon="mdi-calendar-month"
          />
          <div class="d-flex justify-space-between mt-1">
            <v-btn
              size="x-small"
              variant="text"
              prepend-icon="mdi-chevron-left"
              @click="shiftMonth(-1)"
            >Prev</v-btn>
            <v-btn
              size="x-small"
              variant="text"
              @click="selectedMonth = currentMonthIso"
            >This month</v-btn>
            <v-btn
              size="x-small"
              variant="text"
              append-icon="mdi-chevron-right"
              :disabled="selectedMonth >= currentMonthIso"
              @click="shiftMonth(1)"
            >Next</v-btn>
          </div>
        </div>
      </div>
    </v-card>

    <v-main class="p-2">
      <v-container class="elevation-2">
        <v-progress-linear v-if="pending" indeterminate color="indigo" />

        <v-alert v-else-if="error" type="error" density="compact" class="ma-3">
          {{ error.statusMessage || error.message || 'Failed to load billing data' }}
          <div v-if="errorReason === 'usage-admin'" class="mt-1 text-caption">
            Your account is not in <code>NUXT_USAGE_ADMINS</code> — ask the deployment owner to
            add your GitHub login or email.
          </div>
          <div v-else-if="errorReason === 'github-pat-scope'" class="mt-1 text-caption">
            The server-side token does not have permission to call the GitHub Billing API.
            The Billing API only accepts <strong>classic PATs</strong> — set
            <code>NUXT_GITHUB_BILLING_TOKEN</code> to a classic PAT with
            <code>manage_billing:copilot</code> (for organization scope) or
            <code>manage_billing:enterprise</code> (for enterprise scope).
            Fine-grained PATs and GitHub Apps are not supported by these endpoints.
          </div>
        </v-alert>

        <v-alert v-else-if="!items.length" type="info" density="compact" class="ma-3">
          <div>
            No billing data returned for {{ data?.organization || data?.enterprise }}
            <span v-if="periodLabel">in <strong>{{ periodLabel }}</strong></span>
            <span v-else>in this period</span>.
          </div>
          <div v-if="!isCurrentMonth" class="mt-2 text-caption">
            GitHub's live billing API typically only returns data for the
            <strong>current calendar month</strong>. Historical months will
            populate here once the <em>Billing CSV ingest</em> in Admin Panel
            has run for that range (the read path will switch to the database
            once Phase B lands).
          </div>
        </v-alert>

        <template v-else>
          <v-alert
            v-if="periodLabel"
            type="info"
            variant="tonal"
            density="compact"
            class="mx-3 mt-3 mb-0"
            icon="mdi-calendar-range"
          >
            Showing billing usage for <strong>{{ periodLabel }}</strong>.
            Use the <em>Billing month</em> picker above to view a different
            month. GitHub retains roughly 90 days of detail.
          </v-alert>

          <div class="d-flex flex-wrap gap-3 pa-3">
            <v-card variant="tonal" color="cyan-darken-2" min-width="180">
              <v-card-text>
                <div class="text-caption">Total credits</div>
                <div class="text-h5 font-weight-bold">
                  {{ totalGrossQty.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
                </div>
              </v-card-text>
            </v-card>
            <v-card variant="tonal" color="green" min-width="180">
              <v-card-text>
                <div class="text-caption">Gross cost (USD)</div>
                <div class="text-h5 font-weight-bold">${{ totalGrossAmount.toFixed(2) }}</div>
              </v-card-text>
            </v-card>
            <v-card variant="tonal" color="indigo" min-width="180">
              <v-card-text>
                <div class="text-caption">Net cost (USD)</div>
                <div class="text-h5 font-weight-bold">${{ totalNetAmount.toFixed(2) }}</div>
              </v-card-text>
            </v-card>
          </div>

          <!-- Per-user breakdown — sourced from /api/user-metrics for the
               full user list, billing $ lazy-loaded per visible v-data-table
               page from /api/billing-credits-by-user. -->
          <v-alert
            v-if="perUserRows.length > 0 && noPerUserAttribution"
            type="info"
            variant="tonal"
            density="comfortable"
            class="mx-3 mt-3 mb-2"
            icon="mdi-account-off-outline"
          >
            <div class="font-weight-medium mb-1">No per-user attribution available for this enterprise</div>
            <div class="text-body-2">
              The aggregate tiles above show real spend, but GitHub's billing
              JSON returned zero items for every user we've fetched
              ({{ loadedLoginsCount }} of {{ perUserRows.length }} loaded).
              Some plans (typically pooled / fully-discounted enterprise
              billing) report spend at the enterprise level only and do not
              tag individual users. Per-user charts and the breakdown table
              are hidden until GitHub starts returning attributed data.
            </div>
          </v-alert>
          <v-row v-if="perUserRows.length > 0 && !noPerUserAttribution" dense class="px-3 mt-2">
            <v-col cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  Top spenders by net cost
                  <span class="text-caption text-medium-emphasis ml-2">
                    (loaded {{ loadedLoginsCount }} of {{ perUserRows.length }} users<span v-if="loadedLoginsCount < perUserRows.length">; sort by $ or page through to load more</span>)
                  </span>
                </v-card-title>
                <v-card-text>
                  <div v-if="topSpendersChartData" style="height: 280px">
                    <Bar :data="topSpendersChartData" :options="topSpendersChartOptions" />
                  </div>
                  <v-alert v-else type="info" variant="tonal" density="compact">
                    No per-user spend loaded yet — page through the table below to
                    populate billing for visible users.
                  </v-alert>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  Top token users (CLI)
                  <span class="text-caption text-medium-emphasis ml-2">
                    (prompt + output)
                  </span>
                </v-card-title>
                <v-card-text>
                  <div v-if="topTokensChartData" style="height: 280px">
                    <Bar :data="topTokensChartData" :options="topTokensChartOptions" />
                  </div>
                  <v-alert v-else type="info" variant="tonal" density="compact">
                    No per-user CLI token usage available — load the User Metrics tab
                    once so token data is fetched, then revisit.
                  </v-alert>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <v-card v-if="perUserRows.length > 0 && !noPerUserAttribution" variant="outlined" class="ma-3">
            <v-card-title class="text-subtitle-1">
              Per-user breakdown
              <span class="text-caption text-medium-emphasis ml-2">
                ({{ loadedLoginsCount }} of {{ perUserRows.length }} loaded)
                <v-progress-circular
                  v-if="perUserLoading" indeterminate size="14" width="2" class="ml-2"
                />
              </span>
            </v-card-title>
            <v-data-table
              :items="perUserRows"
              :headers="perUserHeaders"
              density="compact"
              :items-per-page="25"
              :sort-by="[{ key: 'user', order: 'asc' }]"
              @update:options="onTableOptions"
            >
              <template #[`item.netAmount`]="{ item }">
                ${{ (item as PerUserRow).netAmount.toFixed(2) }}
              </template>
              <template #[`item.grossAmount`]="{ item }">
                ${{ (item as PerUserRow).grossAmount.toFixed(2) }}
              </template>
              <template #[`item.credits`]="{ item }">
                {{ (item as PerUserRow).credits.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
              </template>
              <template #[`item.tokens`]="{ item }">
                {{ (item as PerUserRow).tokens > 0
                    ? (item as PerUserRow).tokens.toLocaleString()
                    : '—' }}
              </template>
            </v-data-table>
          </v-card>

          <v-card variant="outlined" class="ma-3">
            <v-card-title class="text-subtitle-1">Raw billing line items</v-card-title>
            <v-data-table
              :items="items"
              :headers="headers"
              density="compact"
              items-per-page="25"
            />
          </v-card>
        </template>
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, reactive, ref, watch, onMounted } from 'vue';
import { Bar } from 'vue-chartjs';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { PALETTE } from '@/utils/chartPlugins';
import type { BillingCreditsResponse, BillingUsageItem } from '../../server/api/billing-credits.get';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface PerUserRow {
  user: string;
  credits: number;
  grossAmount: number;
  netAmount: number;
  tokens: number;
  models: number;
}

export default defineComponent({
  name: 'BillingCreditsViewer',
  components: { Bar },
  props: {
    queryParams: { type: Object as () => Record<string, string>, default: () => ({}) },
  },
  async setup(props) {
    // ── Billing month selector ─────────────────────────────────────────────
    // GitHub's /settings/billing/ai_credit/usage endpoint defaults to the
    // current calendar month. We expose a HTML5 `<input type=month>` so admins
    // can browse the ~90 days of history GitHub retains without editing the
    // URL by hand. State is local-only (no URL round-trip yet — keeps the
    // surface area small; a future change can lift it to the route if shared
    // links matter).
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const monthIso = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}`;
    const currentMonthIso = computed(() => monthIso(new Date()));
    const selectedMonth = ref<string>(currentMonthIso.value); // "YYYY-MM"

    function shiftMonth(delta: number): void {
      const parts = selectedMonth.value.split('-').map(Number);
      const y = parts[0] ?? new Date().getUTCFullYear();
      const m = parts[1] ?? (new Date().getUTCMonth() + 1);
      const dt = new Date(Date.UTC(y, (m - 1) + delta, 1));
      const next = monthIso(dt);
      // Don't allow scrolling past the current month (GitHub returns nothing).
      if (next > currentMonthIso.value) return;
      selectedMonth.value = next;
    }

    const isCurrentMonth = computed(() => selectedMonth.value === currentMonthIso.value);

    // Merge picker state into the parent-provided queryParams. We only
    // override year/month when the user has picked something other than the
    // current month — keeps the default behavior identical to before.
    const billingQuery = computed<Record<string, string>>(() => {
      const merged: Record<string, string> = { ...props.queryParams };
      const [y, m] = selectedMonth.value.split('-');
      if (y && m) {
        merged.year = y;
        merged.month = String(Number(m));
      }
      return merged;
    });

    const { data, pending, error } = await useFetch<BillingCreditsResponse>('/api/billing-credits', {
      query: billingQuery,
      server: false,
      watch: [billingQuery],
    });

    // Per-user token totals (and the canonical user list) come from
    // /api/user-metrics. We do NOT fan out billing on initial load — instead,
    // the per-user table emits @update:options with the visible page's logins
    // and we batch-fetch billing on demand. Failures are non-fatal (table
    // still renders with token data; $ columns show "—").
    const { data: userMetricsData } = await useFetch<{ login: string; totals_by_cli?: { token_usage?: { prompt_tokens_sum: number; output_tokens_sum: number } } }[]>(
      '/api/user-metrics',
      {
        query: computed(() => props.queryParams),
        server: false,
      }
    ).catch(() => ({ data: { value: null } }));

    // ── Lazy per-user billing state ────────────────────────────────────────
    // Map login (lowercase) → aggregated billing roll-up. Pages we haven't
    // visited yet are simply absent from the map; perUserRows renders them
    // with $0 / 0 credits / 0 models until the fetch completes.
    interface BillingAgg { credits: number; grossAmount: number; netAmount: number; models: Set<string>; display: string }
    const billingByLogin = reactive(new Map<string, BillingAgg>());
    const loadedLogins = reactive(new Set<string>());
    const perUserLoading = ref(false);

    // When the user switches month, drop cached per-user roll-ups so the
    // visible page re-fetches against the new window.
    watch(selectedMonth, () => {
      billingByLogin.clear();
      loadedLogins.clear();
    });

    async function loadBillingForLogins(logins: string[]): Promise<void> {
      const needed = logins.filter(l => l && !loadedLogins.has(l.toLowerCase()));
      if (needed.length === 0) return;
      // Mark as "in-flight" up front so concurrent page changes don't double-fetch.
      for (const l of needed) loadedLogins.add(l.toLowerCase());
      perUserLoading.value = true;
      try {
        // Chunk to the endpoint's per-call cap (50).
        for (let i = 0; i < needed.length; i += 50) {
          const chunk = needed.slice(i, i + 50);
          const qp: Record<string, string> = { ...(props.queryParams || {}), logins: chunk.join(',') };
          const [y, m] = selectedMonth.value.split('-');
          if (y && m) {
            qp.year = y;
            qp.month = String(Number(m));
          }
          try {
            const resp = await $fetch<BillingCreditsResponse>('/api/billing-credits-by-user', { query: qp });
            for (const it of resp.usageItems ?? []) {
              const u = (it.user || '').trim();
              if (!u) continue;
              const key = u.toLowerCase();
              const prev = billingByLogin.get(key) || { credits: 0, grossAmount: 0, netAmount: 0, models: new Set<string>(), display: u };
              prev.credits += Number.isFinite(it.netQuantity) ? it.netQuantity : 0;
              prev.credits += Number.isFinite(it.discountQuantity) ? it.discountQuantity : 0;
              prev.grossAmount += Number.isFinite(it.grossAmount) ? it.grossAmount : 0;
              prev.netAmount += Number.isFinite(it.netAmount) ? it.netAmount : 0;
              if (it.model) prev.models.add(it.model);
              billingByLogin.set(key, prev);
            }
          } catch (err) {
            // Don't unmark — failed fetches stay "loaded" so we don't retry
            // forever; the rows just remain at $0. A page refresh re-tries.
            console.warn('billing-credits-by-user chunk failed', err);
          }
        }
      } finally {
        perUserLoading.value = false;
      }
    }

    // Called by v-data-table @update:options on initial mount, page change,
    // and sort change. We use page + itemsPerPage + the currently-sorted
    // `perUserRows` view to know which logins are visible.
    function onTableOptions(opts: { page: number; itemsPerPage: number }): void {
      const allRows = perUserRows.value;
      if (allRows.length === 0) return;
      const start = (opts.page - 1) * opts.itemsPerPage;
      const visible = allRows.slice(start, start + opts.itemsPerPage).map(r => r.user);
      void loadBillingForLogins(visible);
    }

    const items = computed<BillingUsageItem[]>(() => data.value?.usageItems ?? []);

    /**
     * Human-readable label for the billing period returned by GitHub.
     * GitHub's /settings/billing/ai_credit/usage endpoint defaults to the
     * current calendar month when no year/month/day is passed; the response
     * echoes the applied window in `timePeriod`. Surface it so the totals
     * aren't ambiguous (the card was previously dateless).
     */
    const periodLabel = computed(() => {
      const tp = data.value?.timePeriod;
      if (!tp || (tp.year == null && tp.month == null && tp.day == null)) return '';
      const year = tp.year;
      const month = tp.month;
      const day = tp.day;
      if (year && month && day) {
        return new Date(Date.UTC(year, month - 1, day))
          .toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      }
      if (year && month) {
        return new Date(Date.UTC(year, month - 1, 1))
          .toLocaleDateString(undefined, { year: 'numeric', month: 'long', timeZone: 'UTC' });
      }
      if (year) return String(year);
      return '';
    });

    const totalGrossQty = computed(() =>
      items.value.reduce((s, i) => s + (i.grossQuantity || 0), 0)
    );
    const totalGrossAmount = computed(() =>
      items.value.reduce((s, i) => s + (i.grossAmount || 0), 0)
    );
    const totalNetAmount = computed(() =>
      items.value.reduce((s, i) => s + (i.netAmount || 0), 0)
    );

    // Per-user rows are projected from /api/user-metrics (canonical user list
    // + CLI token totals) and joined with the lazy-loaded billing map. Users
    // we haven't fetched billing for yet appear with $0 / 0 credits and will
    // populate as the v-data-table pages over them.
    const perUserRows = computed<PerUserRow[]>(() => {
      const um = (userMetricsData?.value ?? []) as { login: string; totals_by_cli?: { token_usage?: { prompt_tokens_sum: number; output_tokens_sum: number } } }[];
      if (um.length === 0) return [];
      return um.map(u => {
        const key = u.login.toLowerCase();
        const billing = billingByLogin.get(key);
        const tu = u.totals_by_cli?.token_usage;
        const tokens = tu ? (tu.prompt_tokens_sum || 0) + (tu.output_tokens_sum || 0) : 0;
        return {
          user: billing?.display || u.login,
          credits: billing?.credits || 0,
          grossAmount: billing?.grossAmount || 0,
          netAmount: billing?.netAmount || 0,
          tokens,
          models: billing?.models.size || 0,
        };
      });
    });
    const loadedLoginsCount = computed(() => loadedLogins.size);

    // True when we've loaded at least one page of users AND the aggregate
    // totals show non-zero spend AND zero per-user attribution has come back.
    // This is the common state for pooled / fully-discounted enterprise plans
    // where GitHub's billing JSON does not tag items with a user, so the
    // per-user breakdown would otherwise render N rows of $0 with no
    // explanation of why. When true we suppress the per-user table + charts
    // and surface an explanatory alert instead.
    const noPerUserAttribution = computed(() => {
      if (loadedLogins.size === 0) return false;
      if (totalGrossAmount.value <= 0) return false;
      for (const agg of billingByLogin.values()) {
        if (agg.grossAmount > 0 || agg.netAmount > 0 || agg.credits > 0) return false;
      }
      return true;
    });

    // Pre-populate billingByLogin from the aggregate /api/billing-credits
    // response in mock mode (the fixture has user-tagged items) so Playwright
    // tests + local dev keep working without round-tripping the by-user
    // endpoint. In real mode the aggregate response has no `user` field, so
    // this loop is a no-op there.
    onMounted(() => {
      const seeded = data.value?.usageItems ?? [];
      for (const it of seeded) {
        const u = (it.user || '').trim();
        if (!u) continue;
        const key = u.toLowerCase();
        const prev = billingByLogin.get(key) || { credits: 0, grossAmount: 0, netAmount: 0, models: new Set<string>(), display: u };
        prev.credits += Number.isFinite(it.netQuantity) ? it.netQuantity : 0;
        prev.credits += Number.isFinite(it.discountQuantity) ? it.discountQuantity : 0;
        prev.grossAmount += Number.isFinite(it.grossAmount) ? it.grossAmount : 0;
        prev.netAmount += Number.isFinite(it.netAmount) ? it.netAmount : 0;
        if (it.model) prev.models.add(it.model);
        billingByLogin.set(key, prev);
        loadedLogins.add(key);
      }
    });

    // Distinguish "our admin gate" 403 from "GitHub billing API" 403, since the
    // remediation steps are very different.
    const errorReason = computed<'usage-admin' | 'github-pat-scope' | 'other' | null>(() => {
      const err = error.value as { statusCode?: number; statusMessage?: string; data?: { message?: string } } | null;
      if (!err || err.statusCode !== 403) return null;
      const msg = (err.statusMessage || '') + ' ' + (err.data?.message || '');
      if (msg.includes('NUXT_USAGE_ADMINS')) return 'usage-admin';
      if (/personal access token|administration|manage_billing|insufficient/i.test(msg)) return 'github-pat-scope';
      return 'other';
    });

    const headers = [
      { title: 'Product', key: 'product', sortable: true },
      { title: 'SKU', key: 'sku', sortable: true },
      { title: 'Model', key: 'model', sortable: true },
      { title: 'User', key: 'user', sortable: true },
      { title: 'Gross Qty', key: 'grossQuantity', sortable: true },
      { title: 'Gross $', key: 'grossAmount', sortable: true },
      { title: 'Discount $', key: 'discountAmount', sortable: true },
      { title: 'Net $', key: 'netAmount', sortable: true },
    ];

    const perUserHeaders = [
      { title: 'User', key: 'user', sortable: true },
      { title: 'Credits', key: 'credits', sortable: true, align: 'end' as const },
      { title: 'Tokens (CLI)', key: 'tokens', sortable: true, align: 'end' as const },
      { title: 'Gross $', key: 'grossAmount', sortable: true, align: 'end' as const },
      { title: 'Net $', key: 'netAmount', sortable: true, align: 'end' as const },
      { title: 'Models', key: 'models', sortable: true, align: 'end' as const },
    ];

    const topSpendersChartData = computed(() => {
      // Sort by netAmount desc and drop $0 rows so enterprises with no
      // per-user attribution (or pages we haven't lazy-loaded yet) don't
      // render a chart full of zero bars labelled "top spenders".
      const withSpend = perUserRows.value.filter(r => r.netAmount > 0);
      if (withSpend.length === 0) return null;
      const top = [...withSpend].sort((a, b) => b.netAmount - a.netAmount).slice(0, 10);
      return {
        labels: top.map(r => r.user),
        datasets: [
          {
            label: 'Net spend (USD)',
            data: top.map(r => +r.netAmount.toFixed(2)),
            backgroundColor: PALETTE?.[0]?.bg ?? '#3f51b5',
            borderRadius: 4,
          },
        ],
      };
    });

    const topSpendersChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed: { x: number } }) =>
              ctx.parsed.x.toLocaleString(undefined, { style: 'currency', currency: 'USD' }),
          },
        },
      },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'USD' } },
      },
    };

    const topTokensChartData = computed(() => {
      const withTokens = perUserRows.value.filter(r => r.tokens > 0);
      if (withTokens.length === 0) return null;
      const top = [...withTokens].sort((a, b) => b.tokens - a.tokens).slice(0, 10);
      return {
        labels: top.map(r => r.user),
        datasets: [
          {
            label: 'Tokens',
            data: top.map(r => r.tokens),
            backgroundColor: PALETTE?.[2]?.bg ?? '#7e57c2',
            borderRadius: 4,
          },
        ],
      };
    });

    const topTokensChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y' as const,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed: { x: number } }) =>
              `${ctx.parsed.x.toLocaleString()} tokens`,
          },
        },
      },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'Tokens' } },
      },
    };

    return {
      data, pending, error, items, periodLabel,
      selectedMonth, currentMonthIso, shiftMonth, isCurrentMonth,
      totalGrossQty, totalGrossAmount, totalNetAmount,
      errorReason, headers,
      perUserRows, perUserHeaders,
      perUserLoading, loadedLoginsCount, onTableOptions, noPerUserAttribution,
      topSpendersChartData, topSpendersChartOptions,
      topTokensChartData, topTokensChartOptions,
    };
  },
});
</script>

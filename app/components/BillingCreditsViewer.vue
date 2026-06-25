<template>
  <div>
    <v-card variant="outlined" class="mx-4 mt-3 mb-2 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">💳 AI Credit Billing</div>
          <div class="text-medium-emphasis">
            Aggregate breakdown of premium-request spend by model and SKU,
            sourced from the GitHub Billing API. Visible to every dashboard
            user by default; restrict via <code>NUXT_USAGE_ADMINS</code>.
          </div>
          <div class="text-caption text-medium-emphasis mt-1">
            Per-user attribution below comes from the <code>user</code> field on the
            enterprise billing endpoint when available.
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
            Use a classic PAT with <code>manage_billing:copilot</code> (for organization scope)
            or <code>manage_billing:enterprise</code> (for enterprise scope), or grant the
            GitHub App <em>Administration: Read</em> / <em>Enterprise billing: Read</em>.
            Fine-grained PATs are not supported by these endpoints.
          </div>
        </v-alert>

        <v-alert v-else-if="!items.length" type="info" density="compact" class="ma-3">
          No billing data returned for {{ data?.organization || data?.enterprise }} in this period.
        </v-alert>

        <template v-else>
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

          <!-- Per-user breakdown — visible only when the billing response has
               user attribution on at least one row. -->
          <v-row v-if="perUserRows.length > 0" dense class="px-3 mt-2">
            <v-col cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  Top spenders by net cost
                  <span class="text-caption text-medium-emphasis ml-2">
                    ({{ perUserRows.length }} users with billing attribution)
                  </span>
                </v-card-title>
                <v-card-text>
                  <div style="height: 280px">
                    <Bar :data="topSpendersChartData" :options="topSpendersChartOptions" />
                  </div>
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

          <v-card v-if="perUserRows.length > 0" variant="outlined" class="ma-3">
            <v-card-title class="text-subtitle-1">Per-user breakdown</v-card-title>
            <v-data-table
              :items="perUserRows"
              :headers="perUserHeaders"
              density="compact"
              items-per-page="25"
              :sort-by="[{ key: 'netAmount', order: 'desc' }]"
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
import { defineComponent, computed } from 'vue';
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
    const { data, pending, error } = await useFetch<BillingCreditsResponse>('/api/billing-credits', {
      query: computed(() => props.queryParams),
      server: false,
    });

    // Per-user token usage joined from the User Metrics endpoint (CLI tokens are
    // the only per-user token signal GitHub exposes today). Failure is non-fatal:
    // the table just shows "—" in the tokens column.
    const { data: userMetricsData } = await useFetch<{ login: string; totals_by_cli?: { token_usage?: { prompt_tokens_sum: number; output_tokens_sum: number } } }[]>(
      '/api/user-metrics',
      {
        query: computed(() => props.queryParams),
        server: false,
      }
    ).catch(() => ({ data: { value: null } }));

    const items = computed<BillingUsageItem[]>(() => data.value?.usageItems ?? []);

    const totalGrossQty = computed(() =>
      items.value.reduce((s, i) => s + (i.grossQuantity || 0), 0)
    );
    const totalGrossAmount = computed(() =>
      items.value.reduce((s, i) => s + (i.grossAmount || 0), 0)
    );
    const totalNetAmount = computed(() =>
      items.value.reduce((s, i) => s + (i.netAmount || 0), 0)
    );

    // Build per-user roll-up from billing items, then join token usage from /api/user-metrics
    // by login (case-insensitive).
    const perUserRows = computed<PerUserRow[]>(() => {
      const map = new Map<string, { credits: number; grossAmount: number; netAmount: number; models: Set<string> }>();
      for (const it of items.value) {
        const u = (it.user || '').trim();
        if (!u) continue;
        const key = u.toLowerCase();
        const prev = map.get(key) || { credits: 0, grossAmount: 0, netAmount: 0, models: new Set<string>() };
        prev.credits += Number.isFinite(it.netQuantity) ? it.netQuantity : 0;
        prev.credits += Number.isFinite(it.discountQuantity) ? it.discountQuantity : 0;
        prev.grossAmount += Number.isFinite(it.grossAmount) ? it.grossAmount : 0;
        prev.netAmount += Number.isFinite(it.netAmount) ? it.netAmount : 0;
        if (it.model) prev.models.add(it.model);
        map.set(key, prev);
      }
      const tokensByLogin = new Map<string, number>();
      const um = userMetricsData?.value as { login: string; totals_by_cli?: { token_usage?: { prompt_tokens_sum: number; output_tokens_sum: number } } }[] | null;
      for (const u of um ?? []) {
        const tu = u.totals_by_cli?.token_usage;
        if (tu) {
          tokensByLogin.set(u.login.toLowerCase(), (tu.prompt_tokens_sum || 0) + (tu.output_tokens_sum || 0));
        }
      }
      // Recover the original-case login from the first billing row we saw.
      const displayLogin = new Map<string, string>();
      for (const it of items.value) {
        const u = (it.user || '').trim();
        if (u && !displayLogin.has(u.toLowerCase())) displayLogin.set(u.toLowerCase(), u);
      }
      return Array.from(map, ([key, v]) => ({
        user: displayLogin.get(key) || key,
        credits: v.credits,
        grossAmount: v.grossAmount,
        netAmount: v.netAmount,
        tokens: tokensByLogin.get(key) || 0,
        models: v.models.size,
      })).sort((a, b) => b.netAmount - a.netAmount || b.credits - a.credits);
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
      const top = perUserRows.value.slice(0, 10);
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
      data, pending, error, items,
      totalGrossQty, totalGrossAmount, totalNetAmount,
      errorReason, headers,
      perUserRows, perUserHeaders,
      topSpendersChartData, topSpendersChartOptions,
      topTokensChartData, topTokensChartOptions,
    };
  },
});
</script>

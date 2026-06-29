<template>
  <div>
    <v-card variant="outlined" class="mx-4 mt-3 mb-2 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="d-flex align-center gap-2">
            <div class="font-weight-bold text-body-1 mb-1">🧑‍💻 My Usage</div>
          </div>
          <div class="text-medium-emphasis">
            Your personal Copilot activity for the reporting period. Data is filtered server-side
            to your authenticated user only — you can't see other users from this tab.
          </div>
        </div>
      </div>
    </v-card>

    <v-main class="p-2">
      <v-container class="elevation-2" :fluid="chartColumns === 'full'" :class="chartColumns === 'full' ? 'px-0' : ''">
        <v-progress-linear v-if="pending" indeterminate color="indigo" />

        <v-alert v-else-if="error" type="error" density="compact" class="ma-3">
          {{ error.statusMessage || error.message || 'Failed to load your usage' }}
        </v-alert>

        <v-alert v-else-if="!data || (!data.totals && !data.spend && !data.spendWarning && !cliTotals)" type="info" density="compact" class="ma-3">
          No Copilot usage recorded for <strong>{{ data?.user?.login }}</strong> in this period.
          <div class="text-caption mt-1">
            You may not have a Copilot seat assigned, or the reporting window may not include any
            of your active days.
          </div>
        </v-alert>

        <template v-else>
          <!-- Chart layout toggle -->
          <div class="d-flex justify-end pa-3 pb-0">
            <v-btn-toggle v-model="chartColumns" density="compact" variant="outlined" mandatory>
              <v-btn value="1" size="small" title="Single column"><v-icon size="18">mdi-view-agenda</v-icon></v-btn>
              <v-btn value="2" size="small" title="Two columns"><v-icon size="18">mdi-view-grid</v-icon></v-btn>
              <v-btn value="full" size="small" title="Full width"><v-icon size="18">mdi-fullscreen</v-icon></v-btn>
            </v-btn-toggle>
          </div>

          <div class="d-flex align-center pa-3">
            <v-avatar size="48" color="indigo" class="mr-3">
              <span class="text-h6 text-white">{{ initials }}</span>
            </v-avatar>
            <div>
              <div class="text-h6">{{ data.user.login }}</div>
              <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
            </div>
          </div>

          <v-alert
            v-if="!data.totals"
            type="info"
            variant="tonal"
            density="compact"
            class="mx-3 mb-3"
          >
            No Copilot <strong>completion</strong> metrics for this period — the cards below show
            CLI activity and/or AI credit spend, which are reported separately.
          </v-alert>

          <v-row v-if="data.totals" dense class="px-3">
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="indigo" class="h-100">
                <v-card-text>
                  <div class="text-caption">Active days</div>
                  <div class="text-h4 font-weight-bold">{{ data.totals.total_active_days }}</div>
                  <div v-if="data.totals.ai_adoption_phase" class="text-caption mt-1">
                    <v-chip size="x-small" color="indigo" variant="outlined" :title="`AI adoption phase ${data.totals.ai_adoption_phase.phase_number} (${data.totals.ai_adoption_phase.version})`">
                      {{ data.totals.ai_adoption_phase.phase }}
                    </v-chip>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="green" class="h-100">
                <v-card-text>
                  <div class="text-caption">Interactions</div>
                  <div class="text-h4 font-weight-bold">
                    {{ data.totals.user_initiated_interaction_count.toLocaleString() }}
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="deep-purple" class="h-100">
                <v-card-text>
                  <div class="text-caption">Accepted lines</div>
                  <div class="text-h4 font-weight-bold">
                    {{ data.totals.loc_added_sum.toLocaleString() }}
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="cyan-darken-2" class="h-100">
                <v-card-text>
                  <div class="text-caption">AI credits used</div>
                  <div class="text-h4 font-weight-bold">
                    <template v-if="typeof data.totals.ai_credits_used === 'number'">
                      {{ data.totals.ai_credits_used.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
                    </template>
                    <template v-else>
                      <span class="text-disabled" title="GitHub has not reported AI credits for this period">—</span>
                    </template>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- GitHub CLI usage (tokens, sessions, version). Only shown when the
               user actually used the CLI in the reporting period. -->
          <v-row v-if="cliTotals" dense class="px-3 mt-2">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1 d-flex align-center">
                  <v-icon size="small" class="mr-1">mdi-console</v-icon>
                  GitHub CLI usage
                  <v-chip v-if="cliTotals.last_known_cli_version" size="x-small" variant="outlined" class="ml-2"
                          :title="`Sampled ${cliTotals.last_known_cli_version.sampled_at}`">
                    v{{ cliTotals.last_known_cli_version.cli_version }}
                  </v-chip>
                </v-card-title>
                <v-card-text>
                  <v-row dense>
                    <v-col cols="6" md="3">
                      <div class="text-caption">Sessions</div>
                      <div class="text-h6">{{ cliTotals.session_count.toLocaleString() }}</div>
                    </v-col>
                    <v-col cols="6" md="3">
                      <div class="text-caption">Requests</div>
                      <div class="text-h6">{{ cliTotals.request_count.toLocaleString() }}</div>
                    </v-col>
                    <v-col v-if="cliTotals.token_usage" cols="6" md="3">
                      <div class="text-caption">Prompt tokens</div>
                      <div class="text-h6">{{ cliTotals.token_usage.prompt_tokens_sum.toLocaleString() }}</div>
                    </v-col>
                    <v-col v-if="cliTotals.token_usage" cols="6" md="3">
                      <div class="text-caption">Output tokens</div>
                      <div class="text-h6">{{ cliTotals.token_usage.output_tokens_sum.toLocaleString() }}</div>
                    </v-col>
                  </v-row>
                  <div v-if="cliTotals.token_usage" class="text-caption text-medium-emphasis mt-2">
                    Avg {{ Math.round(cliTotals.token_usage.avg_tokens_per_request).toLocaleString() }} tokens/request
                    ({{ cliTotals.prompt_count.toLocaleString() }} CLI prompts).
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Per-user AI credit spend, sourced from the enterprise billing
               endpoint with `?user=<self>`. Only the user's own data is ever
               fetched — never another user's. Falls back to a small inline
               warning when the billing call fails (e.g. SSO not authorized). -->
          <v-row v-if="data.spend || data.spendWarning" dense class="px-3 mt-2">
            <v-col cols="12">
              <v-card v-if="data.spend" variant="outlined" class="border-cyan">
                <v-card-title class="text-subtitle-1 d-flex align-center">
                  <v-icon size="small" class="mr-1" color="cyan-darken-2">mdi-cash-multiple</v-icon>
                  Your AI credit spend
                  <span class="text-caption text-medium-emphasis ml-2">
                    {{ spendPeriodLabel }}<template v-if="data.spend.enterprise"> · enterprise {{ data.spend.enterprise }}</template>
                  </span>
                </v-card-title>
                <v-card-text>
                  <v-row dense>
                    <v-col cols="12" sm="4">
                      <div class="text-caption">Total spend</div>
                      <div class="text-h4 font-weight-bold text-cyan-darken-2">
                        {{ data.spend.totalAmount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) }}
                      </div>
                    </v-col>
                    <v-col cols="12" sm="4">
                      <div class="text-caption">Credits billed</div>
                      <div class="text-h5">
                        {{ data.spend.totalQuantity.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}
                      </div>
                    </v-col>
                    <v-col cols="12" sm="4">
                      <div class="text-caption">Models billed</div>
                      <div class="text-h5">{{ data.spend.byModel.length }}</div>
                    </v-col>
                  </v-row>
                  <v-table v-if="data.spend.byModel.length > 0" density="compact" class="mt-3">
                    <thead>
                      <tr>
                        <th class="text-left">Model</th>
                        <th class="text-right">Credits</th>
                        <th class="text-right">Spend</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="m in data.spend.byModel" :key="m.model">
                        <td>{{ m.model }}</td>
                        <td class="text-right">{{ m.quantity.toLocaleString(undefined, { maximumFractionDigits: 2 }) }}</td>
                        <td class="text-right">{{ m.amount.toLocaleString(undefined, { style: 'currency', currency: 'USD' }) }}</td>
                      </tr>
                    </tbody>
                  </v-table>
                </v-card-text>
              </v-card>
              <v-alert v-else-if="data.spendWarning" type="warning" variant="tonal" density="compact" class="mb-0">
                Couldn't load your AI credit spend: {{ data.spendWarning }}
                <div class="text-caption mt-1">
                  Check that <code>NUXT_GITHUB_BILLING_TOKEN</code> is a classic PAT with
                  <code>manage_billing:enterprise</code> and is SSO-authorized for the target enterprise.
                </div>
              </v-alert>
            </v-col>
          </v-row>

          <v-row v-if="topIde || topModel" dense class="px-3 mt-2">
            <v-col v-if="topIde" cols="12" :md="chartColumns === '2' ? 6 : 12">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Top IDE</v-card-title>
                <v-card-text>
                  <strong>{{ topIde.ide }}</strong> —
                  {{ topIde.user_initiated_interaction_count.toLocaleString() }} interactions
                  <div v-if="topIde.last_known_ide_version || topIde.last_known_plugin_version" class="text-caption text-medium-emphasis mt-1">
                    <span v-if="topIde.last_known_ide_version" :title="`Sampled ${topIde.last_known_ide_version.sampled_at}`">
                      IDE v{{ topIde.last_known_ide_version.ide_version }}
                    </span>
                    <span v-if="topIde.last_known_ide_version && topIde.last_known_plugin_version"> · </span>
                    <span v-if="topIde.last_known_plugin_version" :title="`Sampled ${topIde.last_known_plugin_version.sampled_at}`">
                      {{ topIde.last_known_plugin_version.plugin }} v{{ topIde.last_known_plugin_version.plugin_version }}
                    </span>
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col v-if="topModel" cols="12" :md="chartColumns === '2' ? 6 : 12">
              <v-card variant="outlined" class="h-100">
                <v-card-title class="text-subtitle-1">Top model</v-card-title>
                <v-card-text>
                  <strong>{{ topModel.model }}</strong> ({{ topModel.feature }}) —
                  {{ topModel.user_initiated_interaction_count.toLocaleString() }} interactions
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Daily AI credits chart (only shown when dayRecords are loaded, i.e. when a
               date range is selected — the default 28-day pre-aggregated report does not
               include per-day breakdowns) -->
          <v-row v-if="aiCreditsChartData" dense class="px-3 mt-2">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  Daily AI credit usage
                  <span class="text-caption text-medium-emphasis ml-2">
                    ({{ aiCreditsTotalLabel }} total over {{ aiCreditsDayCount }} active day{{ aiCreditsDayCount === 1 ? '' : 's' }})
                  </span>
                </v-card-title>
                <v-card-text>
                  <div style="height: 240px">
                    <Bar :data="aiCreditsChartData" :options="aiCreditsChartOptions" />
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Source: <code>ai_credits_used</code> on the users-1-day report
                    (populated by GitHub since 2026-06-19).
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
          <v-row v-else-if="data.dayRecords && data.dayRecords.length === 0" dense class="px-3 mt-2">
            <v-col cols="12">
              <v-alert type="info" variant="tonal" density="compact">
                No day-by-day AI credit activity recorded for you in the last 28 days.
              </v-alert>
            </v-col>
          </v-row>

          <!-- Daily $ spend (credits × price) -->
          <v-row v-if="dailySpendChartData" dense class="px-3 mt-2">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  Daily AI credit spend
                  <span class="text-caption text-medium-emphasis ml-2">
                    ({{ dailySpendTotalLabel }} total)
                  </span>
                </v-card-title>
                <v-card-text>
                  <div style="height: 240px">
                    <Bar :data="dailySpendChartData" :options="dailySpendChartOptions" />
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Derived as <code>ai_credits_used × price-per-credit</code>. Price taken from your
                    billing spend response when available, otherwise the GitHub list price ($0.01/credit).
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>

          <!-- Daily CLI token usage (stacked: prompt + output) -->
          <v-row v-if="dailyTokensChartData" dense class="px-3 mt-2">
            <v-col cols="12">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">
                  Daily CLI token usage
                  <span class="text-caption text-medium-emphasis ml-2">
                    ({{ dailyTokensTotalLabel }} tokens total)
                  </span>
                </v-card-title>
                <v-card-text>
                  <div style="height: 260px">
                    <Bar :data="dailyTokensChartData" :options="dailyTokensChartOptions" />
                  </div>
                  <div class="text-caption text-medium-emphasis mt-1">
                    Source: <code>totals_by_cli.token_usage</code> on the users-1-day report.
                    Only CLI tokens are exposed per-day today — IDE token usage is not broken down by day.
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </template>
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed, ref } from 'vue';
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
import type { UserTotals, UserDayRecord } from '../../server/services/github-copilot-usage-api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface MyUsageSpend {
  totalAmount: number;
  totalQuantity: number;
  byModel: { model: string; amount: number; quantity: number }[];
  timePeriod?: { year?: number; month?: number; day?: number };
  enterprise?: string;
}

interface MyUsageResponse {
  user: { login: string; email?: string };
  totals: UserTotals | null;
  dayRecords: UserDayRecord[];
  reportStartDay?: string;
  reportEndDay?: string;
  spend?: MyUsageSpend;
  spendWarning?: string;
}

export default defineComponent({
  name: 'MyUsageViewer',
  components: { Bar },
  props: {
    dateRangeDescription: { type: String, default: '' },
    queryParams: { type: Object as () => Record<string, string>, default: () => ({}) },
  },
  async setup(props) {
    const chartColumns = ref<'1' | '2' | 'full'>('2');
    // useFetch is auto-imported in Nuxt
    const { data, pending, error } = await useFetch<MyUsageResponse>('/api/my-usage', {
      query: computed(() => props.queryParams),
      watch: [() => props.queryParams],
      server: false,
    });

    const initials = computed(() => {
      const login = data.value?.user?.login || '';
      return (login.slice(0, 2) || '?').toUpperCase();
    });

    const topIde = computed(() => {
      const ides = data.value?.totals?.totals_by_ide;
      if (!ides || ides.length === 0) return null;
      return [...ides].sort((a, b) =>
        b.user_initiated_interaction_count - a.user_initiated_interaction_count
      )[0];
    });

    const cliTotals = computed(() => {
      const cli = data.value?.totals?.totals_by_cli;
      // Treat presence of any activity as "show the card"; a totally empty cli
      // object means the API returned it but user did nothing.
      if (!cli) return null;
      if (!cli.session_count && !cli.request_count && !cli.prompt_count) return null;
      return cli;
    });

    const spendPeriodLabel = computed(() => {
      const tp = data.value?.spend?.timePeriod;
      if (!tp) return 'Current billing period';
      const parts: string[] = [];
      if (tp.year) parts.push(String(tp.year));
      if (tp.month) parts.push(String(tp.month).padStart(2, '0'));
      if (tp.day) parts.push(String(tp.day).padStart(2, '0'));
      return parts.length ? parts.join('-') : 'Current billing period';
    });

    const topModel = computed(() => {
      const models = data.value?.totals?.totals_by_model_feature;
      if (!models || models.length === 0) return null;
      return [...models].sort((a, b) =>
        b.user_initiated_interaction_count - a.user_initiated_interaction_count
      )[0];
    });

    // Per-day ai_credits_used chart — only renders when GitHub returned the field
    // for at least one day. Pre-2026-06-19 days won't have it, and even after that
    // a user may have spent 0 credits (premium-request overage only).
    const aiCreditsDayPoints = computed(() => {
      const days = data.value?.dayRecords ?? [];
      const points = days
        .map(r => ({ day: r.day, value: typeof r.ai_credits_used === 'number' ? r.ai_credits_used : null }))
        .filter(p => p.value !== null) as { day: string; value: number }[];
      return points.sort((a, b) => a.day.localeCompare(b.day));
    });

    // Effective $ per credit, derived from the billing spend response when available.
    // Falls back to the GitHub list price of $0.01/credit which matches every row
    // we've seen on the AI credit SKU.
    const pricePerCredit = computed(() => {
      const sp = data.value?.spend;
      if (sp && sp.totalQuantity > 0 && sp.totalAmount > 0) {
        return sp.totalAmount / sp.totalQuantity;
      }
      return 0.01;
    });

    // Daily $ spend = ai_credits_used × price-per-credit, per day.
    const dailySpendChartData = computed(() => {
      const pts = aiCreditsDayPoints.value;
      if (pts.length === 0) return null;
      const ppc = pricePerCredit.value;
      return {
        labels: pts.map(p => p.day),
        datasets: [
          {
            label: 'AI credit spend (USD)',
            data: pts.map(p => +(p.value * ppc).toFixed(4)),
            backgroundColor: PALETTE?.[1]?.bg ?? '#00897b',
            borderRadius: 4,
          },
        ],
      };
    });

    const dailySpendTotalLabel = computed(() => {
      const ppc = pricePerCredit.value;
      const sum = aiCreditsDayPoints.value.reduce((s, p) => s + p.value * ppc, 0);
      return sum.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
    });

    const dailySpendChartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed: { y: number } }) =>
              ctx.parsed.y.toLocaleString(undefined, { style: 'currency', currency: 'USD' }),
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'USD' },
        },
      },
    }));

    // Daily CLI token usage — sums prompt + output tokens from totals_by_cli per day.
    // Only renders when at least one day has token_usage populated (CLI is the only
    // surface where GitHub exposes per-day token counts today).
    const dailyTokenPoints = computed(() => {
      const days = data.value?.dayRecords ?? [];
      const points = days
        .map(r => {
          const tu = r.totals_by_cli?.token_usage;
          if (!tu) return { day: r.day, prompt: null as number | null, output: null as number | null };
          return { day: r.day, prompt: tu.prompt_tokens_sum, output: tu.output_tokens_sum };
        })
        .filter(p => p.prompt !== null || p.output !== null) as { day: string; prompt: number; output: number }[];
      return points.sort((a, b) => a.day.localeCompare(b.day));
    });

    const dailyTokensChartData = computed(() => {
      const pts = dailyTokenPoints.value;
      if (pts.length === 0) return null;
      return {
        labels: pts.map(p => p.day),
        datasets: [
          {
            label: 'Prompt tokens',
            data: pts.map(p => p.prompt),
            backgroundColor: PALETTE?.[2]?.bg ?? '#7e57c2',
            borderRadius: 4,
            stack: 'tokens',
          },
          {
            label: 'Output tokens',
            data: pts.map(p => p.output),
            backgroundColor: PALETTE?.[3]?.bg ?? '#ef6c00',
            borderRadius: 4,
            stack: 'tokens',
          },
        ],
      };
    });

    const dailyTokensTotalLabel = computed(() => {
      const sum = dailyTokenPoints.value.reduce((s, p) => s + p.prompt + p.output, 0);
      return sum.toLocaleString();
    });

    const dailyTokensChartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top' as const },
        tooltip: {
          callbacks: {
            label: (ctx: { dataset: { label?: string }; parsed: { y: number } }) =>
              `${ctx.dataset.label}: ${ctx.parsed.y.toLocaleString()}`,
          },
        },
      },
      scales: {
        x: { stacked: true },
        y: { stacked: true, beginAtZero: true, title: { display: true, text: 'Tokens' } },
      },
    }));

    const aiCreditsChartData = computed(() => {
      const pts = aiCreditsDayPoints.value;
      if (pts.length === 0) return null;
      return {
        labels: pts.map(p => p.day),
        datasets: [
          {
            label: 'AI credits used',
            data: pts.map(p => p.value),
            backgroundColor: PALETTE?.[0]?.bg ?? '#3f51b5',
            borderRadius: 4,
          },
        ],
      };
    });

    const aiCreditsTotalLabel = computed(() => {
      const sum = aiCreditsDayPoints.value.reduce((s, p) => s + p.value, 0);
      return sum.toLocaleString(undefined, { maximumFractionDigits: 2 });
    });

    const aiCreditsDayCount = computed(() =>
      aiCreditsDayPoints.value.filter(p => p.value > 0).length
    );

    const aiCreditsChartOptions = computed(() => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: { parsed: { y: number } }) =>
              `${ctx.parsed.y.toLocaleString(undefined, { maximumFractionDigits: 2 })} credits`,
          },
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          title: { display: true, text: 'AI credits' },
        },
      },
    }));

    return {
      data, pending, error, initials, topIde, topModel, cliTotals, spendPeriodLabel,
      aiCreditsChartData, aiCreditsChartOptions, aiCreditsTotalLabel, aiCreditsDayCount,
      dailySpendChartData, dailySpendChartOptions, dailySpendTotalLabel,
      dailyTokensChartData, dailyTokensChartOptions, dailyTokensTotalLabel,
      chartColumns,
    };
  },
});
</script>

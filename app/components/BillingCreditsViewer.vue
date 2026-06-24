<template>
  <div>
    <v-card variant="outlined" class="mx-4 mt-3 mb-2 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">💳 AI Credit Billing</div>
          <div class="text-medium-emphasis">
            Breakdown of premium-request spend by model and SKU, sourced from the GitHub Billing
            API. Admin-only — gated by the <code>NUXT_USAGE_ADMINS</code> allowlist.
          </div>
          <div class="text-caption text-medium-emphasis mt-1">
            Per-user attribution is available on the <strong>User Metrics</strong> tab via the
            <code>ai_credits_used</code> column (added by GitHub 2026-06-19).
          </div>
        </div>
      </div>
    </v-card>

    <v-main class="p-2">
      <v-container class="elevation-2">
        <v-progress-linear v-if="pending" indeterminate color="indigo" />

        <v-alert v-else-if="error" type="error" density="compact" class="ma-3">
          {{ error.statusMessage || error.message || 'Failed to load billing data' }}
          <div v-if="errorIsForbidden" class="mt-1 text-caption">
            Your account is not in <code>NUXT_USAGE_ADMINS</code> — ask the deployment owner to
            add your GitHub login or email.
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

          <v-data-table
            :items="items"
            :headers="headers"
            density="compact"
            class="elevation-1 ma-3"
            items-per-page="25"
          />
        </template>
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent, computed } from 'vue';
import type { BillingCreditsResponse, BillingUsageItem } from '../../server/api/billing-credits.get';

export default defineComponent({
  name: 'BillingCreditsViewer',
  props: {
    queryParams: { type: Object as () => Record<string, string>, default: () => ({}) },
  },
  async setup(props) {
    const { data, pending, error } = await useFetch<BillingCreditsResponse>('/api/billing-credits', {
      query: computed(() => props.queryParams),
      server: false,
    });

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

    const errorIsForbidden = computed(() => {
      const status = (error.value as { statusCode?: number } | null)?.statusCode;
      return status === 403;
    });

    const headers = [
      { title: 'Product', key: 'product', sortable: true },
      { title: 'SKU', key: 'sku', sortable: true },
      { title: 'Model', key: 'model', sortable: true },
      { title: 'Gross Qty', key: 'grossQuantity', sortable: true },
      { title: 'Gross $', key: 'grossAmount', sortable: true },
      { title: 'Discount $', key: 'discountAmount', sortable: true },
      { title: 'Net $', key: 'netAmount', sortable: true },
    ];

    return {
      data, pending, error, items,
      totalGrossQty, totalGrossAmount, totalNetAmount,
      errorIsForbidden, headers,
    };
  },
});
</script>

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
      <v-container class="elevation-2">
        <v-progress-linear v-if="pending" indeterminate color="indigo" />

        <v-alert v-else-if="error" type="error" density="compact" class="ma-3">
          {{ error.statusMessage || error.message || 'Failed to load your usage' }}
        </v-alert>

        <v-alert v-else-if="!data || !data.totals" type="info" density="compact" class="ma-3">
          No Copilot usage recorded for <strong>{{ data?.user?.login }}</strong> in this period.
          <div class="text-caption mt-1">
            You may not have a Copilot seat assigned, or the reporting window may not include any
            of your active days.
          </div>
        </v-alert>

        <template v-else>
          <div class="d-flex align-center pa-3">
            <v-avatar size="48" color="indigo" class="mr-3">
              <span class="text-h6 text-white">{{ initials }}</span>
            </v-avatar>
            <div>
              <div class="text-h6">{{ data.user.login }}</div>
              <div class="text-caption text-medium-emphasis">{{ dateRangeDescription }}</div>
            </div>
          </div>

          <v-row dense class="px-3">
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="indigo">
                <v-card-text>
                  <div class="text-caption">Active days</div>
                  <div class="text-h4 font-weight-bold">{{ data.totals.total_active_days }}</div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="green">
                <v-card-text>
                  <div class="text-caption">Interactions</div>
                  <div class="text-h4 font-weight-bold">
                    {{ data.totals.user_initiated_interaction_count.toLocaleString() }}
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="deep-purple">
                <v-card-text>
                  <div class="text-caption">Accepted lines</div>
                  <div class="text-h4 font-weight-bold">
                    {{ data.totals.loc_added_sum.toLocaleString() }}
                  </div>
                </v-card-text>
              </v-card>
            </v-col>
            <v-col cols="12" sm="6" md="3">
              <v-card variant="tonal" color="cyan-darken-2">
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

          <v-row v-if="topIde || topModel" dense class="px-3 mt-2">
            <v-col v-if="topIde" cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">Top IDE</v-card-title>
                <v-card-text>
                  <strong>{{ topIde.ide }}</strong> —
                  {{ topIde.user_initiated_interaction_count.toLocaleString() }} interactions
                </v-card-text>
              </v-card>
            </v-col>
            <v-col v-if="topModel" cols="12" md="6">
              <v-card variant="outlined">
                <v-card-title class="text-subtitle-1">Top model</v-card-title>
                <v-card-text>
                  <strong>{{ topModel.model }}</strong> ({{ topModel.feature }}) —
                  {{ topModel.user_initiated_interaction_count.toLocaleString() }} interactions
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
import { defineComponent, computed } from 'vue';
import type { UserTotals, UserDayRecord } from '../../server/services/github-copilot-usage-api';

interface MyUsageResponse {
  user: { login: string; email?: string };
  totals: UserTotals | null;
  dayRecords: UserDayRecord[];
  reportStartDay?: string;
  reportEndDay?: string;
}

export default defineComponent({
  name: 'MyUsageViewer',
  props: {
    dateRangeDescription: { type: String, default: '' },
    queryParams: { type: Object as () => Record<string, string>, default: () => ({}) },
  },
  async setup(props) {
    // useFetch is auto-imported in Nuxt
    const { data, pending, error } = await useFetch<MyUsageResponse>('/api/my-usage', {
      query: computed(() => props.queryParams),
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

    const topModel = computed(() => {
      const models = data.value?.totals?.totals_by_model_feature;
      if (!models || models.length === 0) return null;
      return [...models].sort((a, b) =>
        b.user_initiated_interaction_count - a.user_initiated_interaction_count
      )[0];
    });

    return { data, pending, error, initials, topIde, topModel };
  },
});
</script>

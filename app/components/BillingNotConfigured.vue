<template>
  <div>
    <v-card variant="outlined" class="mx-4 mt-3 mb-2 pa-3" density="compact">
      <div class="d-flex flex-wrap align-start gap-2 text-body-2">
        <div class="mr-3" style="flex: 1; min-width: 250px;">
          <div class="font-weight-bold text-body-1 mb-1">💳 AI Credit Billing</div>
          <div class="text-medium-emphasis">
            This tab surfaces premium-request spend ($ + AI credits) by model, SKU
            and user, sourced from GitHub's enterprise/organization billing API.
            It is not yet configured on this deployment — the steps below explain
            how to turn it on.
          </div>
        </div>
      </div>
    </v-card>

    <v-main class="p-2">
      <v-container class="elevation-2 pa-6">
        <v-alert
          type="info"
          variant="tonal"
          density="comfortable"
          class="mb-6"
          icon="mdi-cog-outline"
        >
          <div class="font-weight-medium mb-1">Billing tab is in preview mode</div>
          <div class="text-body-2">
            You're seeing this placeholder because the server has no GitHub
            billing token configured. Real data appears here for deployment
            admins as soon as <code>NUXT_GITHUB_BILLING_TOKEN</code> is set.
          </div>
        </v-alert>

        <v-row dense>
          <v-col cols="12" md="6">
            <v-card variant="outlined" class="pa-4 h-100">
              <div class="text-subtitle-1 font-weight-medium mb-2">
                <v-icon size="small" class="mr-1">mdi-key-variant</v-icon>
                1. Create a GitHub token
              </div>
              <div class="text-body-2 mb-2">
                Use a <strong>classic PAT</strong> (fine-grained PATs are not
                supported by GitHub's billing endpoints yet) authorised by an
                <strong>enterprise owner</strong> or <strong>billing manager</strong>:
              </div>
              <ul class="ml-4 text-body-2">
                <li><code>manage_billing:enterprise</code> — required for the enterprise billing endpoint</li>
                <li><code>read:enterprise</code> — used by the existing seat/metrics calls</li>
                <li><code>read:org</code> — required for organization-level metrics</li>
              </ul>
              <div class="text-caption text-medium-emphasis mt-2">
                If your enterprise enforces SSO, authorise the PAT for each
                organization after creating it.
              </div>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card variant="outlined" class="pa-4 h-100">
              <div class="text-subtitle-1 font-weight-medium mb-2">
                <v-icon size="small" class="mr-1">mdi-server</v-icon>
                2. Configure the deployment
              </div>
              <div class="text-body-2 mb-2">
                Set these environment variables (or App Service / container
                app settings) and restart:
              </div>
              <v-table density="compact" class="text-body-2">
                <tbody>
                  <tr>
                    <td><code>NUXT_GITHUB_BILLING_TOKEN</code></td>
                    <td>The classic PAT from step 1. Server-only — never exposed to browsers.</td>
                  </tr>
                  <tr>
                    <td><code>NUXT_BILLING_ENTERPRISE</code></td>
                    <td>Enterprise slug to query (e.g. <code>octo-demo-ent</code>). Optional — falls back to <code>NUXT_PUBLIC_GITHUB_ENT</code>.</td>
                  </tr>
                  <tr>
                    <td><code>NUXT_USAGE_ADMINS</code></td>
                    <td>
                      Comma-separated GitHub logins / emails allowed to see the
                      Billing tab. Required in OAuth-mode deployments — leaving
                      it empty hides the Billing tab entirely. In PAT-mode
                      deployments (no OAuth provider configured) the tab is
                      visible without an allowlist.
                    </td>
                  </tr>
                </tbody>
              </v-table>
            </v-card>
          </v-col>

          <v-col cols="12" md="6">
            <v-card variant="outlined" class="pa-4 h-100">
              <div class="text-subtitle-1 font-weight-medium mb-2">
                <v-icon size="small" class="mr-1">mdi-chart-box-outline</v-icon>
                3. What you'll see once it's on
              </div>
              <ul class="ml-4 text-body-2">
                <li>Total gross + net credit spend over the selected period</li>
                <li>Per-model and per-SKU breakdown (Claude / GPT / Codex / Coding Agent etc.)</li>
                <li>Daily spend chart in USD and AI credits</li>
                <li>Per-user table joining spend with the user-metrics user list</li>
                <li>Top spenders by net cost, and top CLI token users</li>
              </ul>
            </v-card>
          </v-col>
        </v-row>

        <div class="text-caption text-medium-emphasis text-center mt-6">
          See the project
          <a
            href="https://github.com/github-copilot-resources/copilot-metrics-viewer#configuration"
            target="_blank"
            rel="noopener noreferrer"
          >README</a>
          for the full configuration reference.
        </div>
      </v-container>
    </v-main>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue';

/**
 * Placeholder shown on the Billing tab when the deployment has no
 * NUXT_GITHUB_BILLING_TOKEN configured. The tab is intentionally still
 * surfaced (instead of being hidden) so that operators of the dashboard
 * discover the feature exists and learn how to enable it. No data is
 * fetched in this state.
 */
export default defineComponent({
  name: 'BillingNotConfigured',
});
</script>

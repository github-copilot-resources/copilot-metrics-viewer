<script lang="ts" setup>
import './assets/global.css'

const route = useRoute()
const setupAction = computed(() => route.query.setup_action as string | undefined)
</script>

<template>
  <v-app>
    <v-main>
      <v-container class="d-flex align-center justify-center" style="min-height: 100vh">
        <v-card width="560" class="pa-4">
          <v-card-title class="text-h5 pb-2">
            <v-icon class="mr-2" color="success">mdi-check-circle</v-icon>
            <span v-if="setupAction === 'update'">App Updated Successfully</span>
            <span v-else>Thanks for Installing!</span>
          </v-card-title>

          <v-card-text>
            <p class="text-body-1 mb-4">
              <span v-if="setupAction === 'update'">
                GitHub Copilot Metrics Viewer has been updated on your organization.
              </span>
              <span v-else>
                GitHub Copilot Metrics Viewer is now installed on your organization.
              </span>
              Head to your deployment to start exploring Copilot usage data.
            </p>

            <v-divider class="mb-4" />

            <p class="text-subtitle-2 text-medium-emphasis mb-2">
              <v-icon size="small" class="mr-1">mdi-database</v-icon>
              Want historical metrics and per-user analytics?
            </p>
            <p class="text-body-2 text-medium-emphasis mb-4">
              The app supports a <strong>self-hosted mode</strong> with a PostgreSQL database that
              stores daily snapshots, enabling month-over-month trends, per-user activity, and seat
              adoption reports — features the GitHub API alone cannot provide.
            </p>

            <v-alert
              type="warning"
              variant="tonal"
              density="compact"
              class="mb-3"
              icon="mdi-shield-account-outline"
            >
              Metrics are only visible to users with the
              <strong>
                <a
                  href="https://docs.github.com/en/rest/copilot/copilot-metrics?apiVersion=2022-11-28#about-copilot-metrics"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-warning"
                >Copilot metrics access</a>
              </strong>
              permission — typically organization owners and billing managers.
            </v-alert>

            <v-alert
              type="info"
              variant="tonal"
              density="compact"
              class="mb-2"
              icon="mdi-book-open-outline"
            >
              See the
              <a
                href="https://github.com/github-copilot-resources/copilot-metrics-viewer/blob/main/DEPLOYMENT.md"
                target="_blank"
                rel="noopener noreferrer"
                class="text-info"
              >DEPLOYMENT.md</a>
              guide for setup instructions, including Docker and Azure deployment options.
            </v-alert>
          </v-card-text>

          <v-card-actions class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              variant="flat"
              prepend-icon="mdi-chart-line"
              href="/"
            >
              Go to Dashboard
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

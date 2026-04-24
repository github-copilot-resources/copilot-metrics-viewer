<script lang="ts" setup>
import './assets/global.css'

const route = useRoute()
const setupAction = computed(() => route.query.setup_action as string | undefined)
const origin = useRequestURL().origin
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
              Head to your <a :href="origin">dashboard</a> to start exploring Copilot usage data.
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

            <v-divider class="mb-4" />

            <p class="text-subtitle-2 text-medium-emphasis mb-2">
              <v-icon size="small" class="mr-1">mdi-information-outline</v-icon>
              How it works
            </p>
            <p class="text-body-2 text-medium-emphasis mb-2">
              When you sign in with GitHub, the app receives a token that is valid for <em>both</em> your
              account and this GitHub App. GitHub enforces the intersection of the two:
            </p>
            <v-table density="compact" class="mb-4 text-body-2">
              <thead>
                <tr>
                  <th>What controls access</th>
                  <th>What it means</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>GitHub App permissions</strong></td>
                  <td>Hard ceiling — the app can only request data it is explicitly authorized for (Copilot Metrics, Seat Management, Members)</td>
                </tr>
                <tr>
                  <td><strong>Your own GitHub permissions</strong></td>
                  <td>Your org role still applies — you can only see orgs and data you personally have access to</td>
                </tr>
              </tbody>
            </v-table>
            <p class="text-body-2 text-medium-emphasis mb-4">
              Neither party alone can escalate privileges. Even if you are an org owner, the token
              cannot perform any action the App is not authorized for — and vice versa.
            </p>

            <v-alert
              type="success"
              variant="tonal"
              density="compact"
              class="mb-3"
              icon="mdi-shield-check-outline"
            >
              <strong>Privacy:</strong> This app does not store, collect, or transmit your Copilot data.
              All API calls are made directly to GitHub using <em>your own credentials</em> — no data passes through our servers.
            </v-alert>

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

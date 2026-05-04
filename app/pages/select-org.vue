<script lang="ts" setup>
import './assets/global.css'

const router = useRouter()
const { session } = useUserSession()

interface OrgEntry {
  login: string
  type: string
}

// Organizations populated by onSuccess during login — no extra API call needed.
const organizations = computed<OrgEntry[]>(() => (session.value as { organizations?: OrgEntry[] })?.organizations ?? [])

const selected = ref<string | null>(null)
const manualOrg = ref('')

const showManualInput = computed(() => organizations.value.length === 0)

watch(organizations, (orgs) => {
  if (orgs.length === 1) {
    router.replace(`/orgs/${orgs[0]!.login}`)
  } else if (orgs.length > 1) {
    selected.value = orgs[0]!.login
  }
}, { immediate: true })

function navigate() {
  if (selected.value) {
    router.push(`/orgs/${selected.value}`)
  } else if (manualOrg.value.trim()) {
    router.push(`/orgs/${manualOrg.value.trim()}`)
  }
}
</script>

<template>
  <v-app>
    <v-main>
      <v-container class="d-flex align-center justify-center" style="min-height: 100vh">
        <v-card width="480" class="pa-4">
          <v-card-title class="text-h5 pb-2">
            <v-icon class="mr-2" color="primary">mdi-office-building</v-icon>
            Select Organization
          </v-card-title>

          <v-card-text>
            <v-alert
              type="success"
              variant="tonal"
              density="compact"
              class="mb-4"
              icon="mdi-shield-check-outline"
            >
              <strong>Privacy:</strong> This app does not store, collect, or transmit your Copilot data.
              All API calls go directly to GitHub using your own credentials — no data passes through our servers.
            </v-alert>

            <template v-if="showManualInput">
              <p class="text-body-2 text-medium-emphasis mb-4">
                Enter the GitHub organization or enterprise slug to view its Copilot metrics.
              </p>
              <v-text-field
                v-model="manualOrg"
                label="Organization"
                placeholder="my-org"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="mdi-domain"
                @keyup.enter="navigate"
              />
            </template>

            <template v-else-if="organizations.length > 1">
              <p class="text-body-2 text-medium-emphasis mb-4">
                Select which organization to view.
              </p>
              <v-select
                v-model="selected"
                :items="organizations"
                item-title="login"
                item-value="login"
                label="Organization"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="mdi-domain"
              />
            </template>
          </v-card-text>

          <v-card-actions v-if="organizations.length > 1 || showManualInput" class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              variant="flat"
              :disabled="!selected && !manualOrg.trim()"
              @click="navigate"
            >
              Continue
            </v-btn>
          </v-card-actions>
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

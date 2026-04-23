<script lang="ts" setup>
import './assets/global.css'

const router = useRouter()

interface Installation {
  login: string
  type: string
}

const installations = ref<Installation[]>([])
const selected = ref<string | null>(null)
const manualOrg = ref('')
const loading = ref(true)
const error = ref<string | null>(null)

// When installations is empty (public app + non-GitHub login), show a text input instead.
const showManualInput = computed(() => !loading.value && !error.value && installations.value.length === 0)

onMounted(async () => {
  try {
    const data = await $fetch<{ installations: Installation[] }>('/api/installations')
    installations.value = data.installations

    if (installations.value.length === 1) {
      // Single org — navigate immediately without showing picker
      await router.replace(`/orgs/${installations.value[0].login}`)
    } else if (installations.value.length > 1) {
      selected.value = installations.value[0].login
    }
    // length === 0 → showManualInput will be true
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load organizations'
  } finally {
    loading.value = false
  }
})

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
            <template v-if="loading">
              <v-progress-linear indeterminate color="primary" class="mb-4" />
              <p class="text-body-2 text-medium-emphasis">Loading accessible organizations…</p>
            </template>

            <template v-else-if="error">
              <v-alert type="error" variant="tonal" class="mb-4">{{ error }}</v-alert>
              <p class="text-body-2 text-medium-emphasis">
                Make sure the GitHub App is installed on your organization.
              </p>
            </template>

            <template v-else-if="showManualInput">
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

            <template v-else-if="installations.length > 1">
              <p class="text-body-2 text-medium-emphasis mb-4">
                Select which organization to view.
              </p>
              <v-select
                v-model="selected"
                :items="installations"
                item-title="login"
                item-value="login"
                label="Organization"
                variant="outlined"
                density="comfortable"
                prepend-inner-icon="mdi-domain"
              />
            </template>
          </v-card-text>

          <v-card-actions v-if="!loading && !error && (installations.length > 1 || showManualInput)" class="px-4 pb-4">
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

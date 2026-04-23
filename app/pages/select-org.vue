<script lang="ts" setup>
import './assets/global.css'

const { loggedIn, user } = useUserSession()
const router = useRouter()

interface Installation {
  login: string
  type: string
}

const installations = ref<Installation[]>([])
const selected = ref<string | null>(null)
const loading = ref(true)
const error = ref<string | null>(null)

onMounted(async () => {
  try {
    const data = await $fetch<{ installations: Installation[] }>('/api/installations')
    installations.value = data.installations

    if (installations.value.length === 0) {
      error.value = 'No accessible organizations found. Make sure the GitHub App is installed on your org.'
    } else if (installations.value.length === 1) {
      // Single org — navigate immediately without showing picker
      await router.replace(`/orgs/${installations.value[0].login}`)
    } else {
      selected.value = installations.value[0].login
    }
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to load organizations'
  } finally {
    loading.value = false
  }
})

function navigate() {
  if (selected.value) {
    router.push(`/orgs/${selected.value}`)
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

            <template v-else-if="installations.length > 1">
              <p class="text-body-2 text-medium-emphasis mb-4">
                The app is installed on multiple organizations. Select which one to view.
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

          <v-card-actions v-if="!loading && !error && installations.length > 1" class="px-4 pb-4">
            <v-spacer />
            <v-btn
              color="primary"
              variant="flat"
              :disabled="!selected"
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

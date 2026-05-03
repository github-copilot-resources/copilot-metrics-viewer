<script setup lang="ts">
import { ref, computed } from 'vue'
import { useMsal } from '~/composables/useMsal'
import { matchEmailsToLogins } from '../../shared/utils/org-login-matching'
import type { OrgSearchResult, OrgReportsResponse } from '../../shared/types/org-tree'
import type { UserTotals } from '../../shared/types/org-tree'

const props = defineProps<{
  userMetrics: UserTotals[]
}>()

const emit = defineEmits<{
  select: [logins: string[], label: string]
}>()

const config = useRuntimeConfig()
const route = useRoute()
const isMockMode = computed(() =>
  config.public.isDataMocked === true || config.public.isDataMocked === 'true' ||
  route.query.mock === 'true' || route.query.mock === '1'
)

const msal = useMsal()
const isSignedIn = msal.isSignedIn

// Show sign-in prompt only when MSAL is configured but user is not signed in (and not mock mode)
const showSignInPrompt = computed(() => !isMockMode.value && msal.isConfigured && !isSignedIn.value)
// Show search when signed in via MSAL or when in mock mode (API works without auth)
const showSearch = computed(() => isSignedIn.value || isMockMode.value)

const searchQuery = ref('')
const searchResults = ref<OrgSearchResult[]>([])
const searchLoading = ref(false)
const selectedPerson = ref<OrgSearchResult | null>(null)
const filterCount = ref(0)
const loadingReports = ref(false)
const apiError = ref<string | null>(null)
const signingIn = ref(false)

async function getHeaders(): Promise<Record<string, string>> {
  const token = await msal.acquireTokenSilent()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

let searchTimer: ReturnType<typeof setTimeout> | null = null
function onSearchInput(q: string) {
  if (searchTimer) clearTimeout(searchTimer)
  if (!q || q.length < 2) { searchResults.value = []; return }
  searchTimer = setTimeout(async () => {
    searchLoading.value = true
    try {
      const headers = await getHeaders()
      searchResults.value = await $fetch<OrgSearchResult[]>('/api/org-search', {
        query: { q, ...(isMockMode.value ? { mock: 'true' } : {}) },
        headers,
      })
    } catch {
      searchResults.value = []
    } finally {
      searchLoading.value = false
    }
  }, 300)
}

async function onPersonSelect(person: OrgSearchResult | null) {
  apiError.value = null
  filterCount.value = 0
  if (!person) { emit('select', [], ''); return }
  loadingReports.value = true
  try {
    const headers = await getHeaders()
    const resp = await $fetch<OrgReportsResponse>('/api/org-reports', {
      query: { userUpn: person.userPrincipalName, ...(isMockMode.value ? { mock: 'true' } : {}) },
      headers,
    })
    filterCount.value = resp.count
    const logins = matchEmailsToLogins(resp.members, props.userMetrics)
    emit('select', logins, person.displayName)
  } catch (e: any) {
    apiError.value = e?.data?.message ?? e?.message ?? 'Failed to load reports'
    selectedPerson.value = null
    emit('select', [], '')
  } finally {
    loadingReports.value = false
  }
}

async function signIn() {
  signingIn.value = true
  await msal.signIn()
  signingIn.value = false
}

function clear() {
  selectedPerson.value = null
  searchQuery.value = ''
  searchResults.value = []
  filterCount.value = 0
  apiError.value = null
  emit('select', [], '')
}
</script>

<template>
  <div>
    <!-- Sign-in prompt when MSAL is configured but user is not signed in -->
    <div v-if="showSignInPrompt">
      <v-btn
        variant="outlined"
        prepend-icon="mdi-account-supervisor-outline"
        :loading="signingIn"
        class="filter-signin-btn"
        @click="signIn"
      >
        Sign in to filter by manager
      </v-btn>
      <div v-if="msal.error.value" class="text-caption text-error mt-1">{{ msal.error.value }}</div>
    </div>

    <!-- Active filter chip (after person is selected and reports loaded) -->
    <v-chip
      v-else-if="selectedPerson && !loadingReports"
      closable
      color="primary"
      variant="tonal"
      size="small"
      @click:close="clear"
    >
      <v-icon start size="small">mdi-account-supervisor-outline</v-icon>
      Reports to {{ selectedPerson.displayName }}
      <span v-if="filterCount > 0" class="ml-1 text-caption opacity-80">({{ filterCount }})</span>
    </v-chip>

    <!-- Loading spinner while fetching transitive reports -->
    <div v-else-if="loadingReports" class="d-flex align-center gap-2">
      <v-progress-circular indeterminate size="18" width="2" />
      <span class="text-caption text-medium-emphasis">Loading org reports…</span>
    </div>

    <!-- Search autocomplete -->
    <v-autocomplete
      v-else-if="showSearch"
      v-model="selectedPerson"
      v-model:search="searchQuery"
      :items="searchResults"
      :loading="searchLoading"
      :error="!!apiError"
      :error-messages="apiError ?? undefined"
      item-title="displayName"
      return-object
      label="Filter: reports to…"
      density="compact"
      variant="outlined"
      hide-details="auto"
      clearable
      no-filter
      prepend-inner-icon="mdi-account-supervisor-outline"
      @update:search="onSearchInput"
      @update:model-value="onPersonSelect"
    >
      <template #item="{ props: p, item }">
        <v-list-item v-bind="p">
          <template #subtitle>
            <span class="text-caption">{{ item.raw.jobTitle ?? item.raw.userPrincipalName }}</span>
          </template>
        </v-list-item>
      </template>
    </v-autocomplete>
  </div>
</template>

<style scoped>
.filter-signin-btn {
  height: 40px;
  width: 100%;
  border-color: rgba(var(--v-border-color), var(--v-border-opacity));
  font-size: 0.875rem;
  font-weight: 400;
  letter-spacing: normal;
  text-transform: none;
  justify-content: flex-start;
  padding-inline: 12px;
}
</style>

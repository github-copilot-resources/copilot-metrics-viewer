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

const msal = useMsal()
const isSignedIn = msal.isSignedIn

// --- Paste-token support ---
const SESSION_KEY = 'entra_pasted_token'

interface TokenInfo { token: string; name: string; upn: string; expiresAt: number }

function decodeJwt(token: string): Record<string, any> | null {
  try {
    const payload = token.split('.')[1]
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')))
  } catch { return null }
}

function loadPastedToken(): TokenInfo | null {
  if (import.meta.server) return null
  try {
    const raw = sessionStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const info: TokenInfo = JSON.parse(raw)
    if (Date.now() / 1000 >= info.expiresAt) { sessionStorage.removeItem(SESSION_KEY); return null }
    return info
  } catch { return null }
}

const pastedTokenInfo = ref<TokenInfo | null>(loadPastedToken())
const showPasteInput = ref(false)
const pasteInputValue = ref('')
const pasteError = ref<string | null>(null)

const pastedTokenExpiresIn = computed(() => {
  if (!pastedTokenInfo.value) return ''
  const mins = Math.round((pastedTokenInfo.value.expiresAt - Date.now() / 1000) / 60)
  return mins > 0 ? `${mins}m` : 'expired'
})

function applyPastedToken() {
  pasteError.value = null
  const raw = pasteInputValue.value.trim()
  if (!raw) return
  const claims = decodeJwt(raw)
  if (!claims || !claims.exp) { pasteError.value = 'Invalid token — paste a JWT access token'; return }
  if (Date.now() / 1000 >= claims.exp) { pasteError.value = 'Token has already expired'; return }
  const info: TokenInfo = {
    token: raw,
    name: claims.name ?? claims.unique_name ?? '',
    upn: claims.upn ?? claims.preferred_username ?? claims.unique_name ?? '',
    expiresAt: claims.exp,
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify(info))
  pastedTokenInfo.value = info
  pasteInputValue.value = ''
  showPasteInput.value = false
}

function clearPastedToken() {
  sessionStorage.removeItem(SESSION_KEY)
  pastedTokenInfo.value = null
}

// Show sign-in options when neither MSAL nor pasted token is available
const showSignInPrompt = computed(() =>
  !pastedTokenInfo.value && msal.isConfigured && !isSignedIn.value
)
const showPastePrompt = computed(() =>
  !pastedTokenInfo.value && !msal.isConfigured
)

const searchQuery = ref('')
const searchResults = ref<OrgSearchResult[]>([])
const searchLoading = ref(false)
const selectedPerson = ref<OrgSearchResult | null>(null)
const filterCount = ref(0)
const loadingReports = ref(false)
const apiError = ref<string | null>(null)
const signingIn = ref(false)

async function getHeaders(): Promise<Record<string, string>> {
  // Prefer pasted token if present and not expired
  if (pastedTokenInfo.value && Date.now() / 1000 < pastedTokenInfo.value.expiresAt) {
    return { Authorization: `Bearer ${pastedTokenInfo.value.token}` }
  }
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
        query: { q },
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
      query: { userUpn: person.userPrincipalName },
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
    <!-- MSAL sign-in prompt + paste-token option -->
    <div v-if="showSignInPrompt" class="d-flex align-center gap-2 flex-wrap">
      <span class="text-caption text-medium-emphasis">Org filter:</span>
      <v-btn
        size="x-small"
        variant="outlined"
        prepend-icon="mdi-microsoft"
        :loading="signingIn"
        @click="signIn"
      >
        Sign in
      </v-btn>
      <span class="text-caption text-medium-emphasis">or</span>
      <v-btn size="x-small" variant="text" @click="showPasteInput = !showPasteInput">
        paste token
      </v-btn>
      <span v-if="msal.error.value" class="text-caption text-error">{{ msal.error.value }}</span>
    </div>

    <!-- Paste-token only prompt (MSAL not configured) -->
    <div v-else-if="showPastePrompt" class="d-flex align-center gap-2 flex-wrap">
      <span class="text-caption text-medium-emphasis">Org filter:</span>
      <v-btn size="x-small" variant="outlined" prepend-icon="mdi-key-outline" @click="showPasteInput = !showPasteInput">
        Paste Graph token
      </v-btn>
    </div>

    <!-- Paste-token input panel -->
    <v-expand-transition>
      <div v-if="showPasteInput && !pastedTokenInfo" class="mt-2">
        <v-textarea
          v-model="pasteInputValue"
          label="Paste Azure Graph access token"
          rows="2"
          density="compact"
          variant="outlined"
          hide-details="auto"
          :error-messages="pasteError ?? undefined"
          placeholder="eyJ0eX..."
          @keydown.enter.prevent="applyPastedToken"
        />
        <div class="d-flex align-center gap-2 mt-1 flex-wrap">
          <v-btn size="x-small" color="primary" @click="applyPastedToken">Apply</v-btn>
          <v-btn size="x-small" variant="text" @click="showPasteInput = false">Cancel</v-btn>
          <span class="text-caption text-medium-emphasis">
            Get token:
            <code class="text-caption">az account get-access-token --resource https://graph.microsoft.com --query accessToken -o tsv</code>
          </span>
        </div>
      </div>
    </v-expand-transition>

    <!-- Pasted token badge (token is active) -->
    <div v-if="pastedTokenInfo && !selectedPerson && !loadingReports" class="d-flex align-center gap-2 flex-wrap">
      <v-chip size="small" variant="tonal" color="secondary" prepend-icon="mdi-key-outline">
        {{ pastedTokenInfo.name || pastedTokenInfo.upn }}
        <span class="ml-1 text-caption opacity-70">({{ pastedTokenExpiresIn }})</span>
        <template #append>
          <v-icon size="x-small" class="ml-1" style="cursor:pointer" @click="clearPastedToken">mdi-close</v-icon>
        </template>
      </v-chip>
    </div>

    <!-- Active filter chip (after person is selected and reports loaded) -->
    <v-chip
      v-if="selectedPerson && !loadingReports"
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

    <!-- Search autocomplete (shown when authenticated via MSAL or pasted token) -->
    <v-autocomplete
      v-if="(isSignedIn || pastedTokenInfo) && !selectedPerson && !loadingReports"
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

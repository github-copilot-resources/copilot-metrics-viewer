<template>
  <div class="org-tree-panel">
    <!-- MSAL Sign-in banner (shown when MSAL is configured and user is not signed in) -->
    <div v-if="msalMode && !msal.isSignedIn.value" class="pa-3 pb-2">
      <div class="text-caption text-medium-emphasis font-weight-medium mb-2">🏢 ORG TREE</div>
      <v-alert v-if="msal.error.value" type="warning" density="compact" variant="tonal" class="mb-2 text-caption">
        {{ msal.error.value }}
      </v-alert>
      <v-btn
        color="primary"
        variant="tonal"
        size="small"
        block
        prepend-icon="mdi-microsoft"
        :loading="signingIn"
        @click="onSignIn"
      >
        Sign in with Microsoft
      </v-btn>
      <div class="text-caption text-medium-emphasis mt-2" style="line-height:1.4">
        Sign in to browse your organisation's hierarchy and filter Copilot metrics by manager subtree.
      </div>
    </div>

    <!-- Search / selection area (shown once MSAL is not required, or user is signed in) -->
    <div v-else class="pa-3 pb-2">
      <div class="d-flex align-center justify-space-between mb-2">
        <div class="text-caption text-medium-emphasis font-weight-medium">🏢 ORG TREE</div>
        <!-- MSAL signed-in indicator -->
        <div v-if="msalMode && msal.isSignedIn.value" class="d-flex align-center gap-1">
          <v-tooltip :text="`Signed in as ${msal.activeAccount.value?.username ?? ''}`" location="bottom">
            <template #activator="{ props: tip }">
              <v-chip v-bind="tip" size="x-small" color="success" variant="tonal" closable @click:close="onSignOut">
                <v-icon start size="12">mdi-microsoft</v-icon>
                {{ shortName(msal.activeAccount.value?.name ?? msal.activeAccount.value?.username ?? '') }}
              </v-chip>
            </template>
          </v-tooltip>
        </div>
      </div>

      <v-alert v-if="msalMode && msal.error.value" type="warning" density="compact" variant="tonal" class="mb-2 text-caption">
        {{ msal.error.value }}
        <v-btn v-if="!msal.isSignedIn.value" size="x-small" variant="text" class="ml-1" @click="onSignIn">Sign in</v-btn>
      </v-alert>

      <v-autocomplete
        v-model="selectedResult"
        v-model:search="searchQuery"
        :items="searchResults"
        :loading="searching"
        item-title="displayName"
        item-value="id"
        return-object
        label="Search person…"
        placeholder="Start typing a name"
        density="compact"
        variant="outlined"
        hide-details
        no-filter
        clearable
        :menu-props="{ zIndex: 2400, maxWidth: 340 }"
        @update:search="onSearchInput"
        @update:model-value="onPersonSelected"
      >
        <template #item="{ item, props: itemProps }">
          <v-list-item v-bind="itemProps" :subtitle="item.raw.jobTitle ?? ''">
            <template #prepend>
              <v-avatar size="30" color="primary" class="mr-2">
                <span class="text-caption font-weight-bold text-white">{{ initials(item.raw.displayName) }}</span>
              </v-avatar>
            </template>
          </v-list-item>
        </template>
      </v-autocomplete>
    </div>

    <!-- Loading state -->
    <div v-if="loadingTree" class="d-flex justify-center align-center py-6">
      <v-progress-circular indeterminate color="primary" size="36" />
    </div>

    <!-- Error state -->
    <v-alert v-else-if="treeError" type="error" density="compact" variant="tonal" class="ma-3 text-caption">
      {{ treeError }}
    </v-alert>

    <!-- Empty state -->
    <div v-else-if="!treeRoot" class="text-center text-caption text-medium-emphasis pa-4">
      <v-icon size="40" class="mb-2 d-block" style="opacity:0.3">mdi-account-supervisor-outline</v-icon>
      Search for a person to load their org subtree
    </div>

    <!-- Tree -->
    <div v-else class="px-2 pb-2">
      <!-- Root node banner -->
      <div class="d-flex align-center justify-space-between px-1 pb-1">
        <div class="text-caption text-medium-emphasis">
          Showing {{ treeStats.totalNodes }} people · {{ treeStats.copilotCount }} with Copilot
        </div>
        <v-btn
          size="x-small"
          variant="text"
          icon
          title="Clear tree"
          @click="clearTree"
        >
          <v-icon size="16">mdi-close</v-icon>
        </v-btn>
      </div>

      <!-- Selection banner -->
      <v-chip
        v-if="selectedLogins.length > 0"
        color="primary"
        size="small"
        closable
        class="mb-2 mx-1"
        @click:close="clearSelection"
      >
        {{ selectionLabel }}
      </v-chip>

      <!-- Tree nodes -->
      <OrgTreeNodeItem
        :node="treeRoot"
        :depth="0"
        :selected-logins="selectedLogins"
        @select="onNodeSelect"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed, watch } from 'vue'
import type { OrgTreeNode, OrgSearchResult, OrgTreeResponse, UserTotals } from '#shared/types/org-tree'
import { mapCopilotDataToTree, getSubtreeLogins } from '#shared/utils/org-tree-mapping'
import OrgTreeNodeItem from './OrgTreeNodeItem.vue'

export default defineComponent({
  name: 'OrgTreePanel',
  components: { OrgTreeNodeItem },
  props: {
    userMetrics: {
      type: Array as () => UserTotals[],
      required: true,
      default: () => []
    },
    /** Session user email for auto-load. */
    sessionEmail: {
      type: String,
      default: ''
    }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const config = useRuntimeConfig()
    const msal = useMsal()

    // MSAL mode is active when entraClientId is set in public config and data is not mocked
    const msalMode = computed(() => !!config.public.entraClientId && !config.public.isDataMocked)
    const signingIn = ref(false)

    const searchQuery = ref('')
    const searchResults = ref<OrgSearchResult[]>([])
    const selectedResult = ref<OrgSearchResult | null>(null)
    const searching = ref(false)

    const loadingTree = ref(false)
    const treeError  = ref('')
    const treeRoot   = ref<OrgTreeNode | null>(null)

    const selectedLogins = ref<string[]>([])
    const selectedNodeName = ref('')

    let searchDebounce: ReturnType<typeof setTimeout> | null = null

    function initials(name: string): string {
      return name.split(' ').map(p => p[0] ?? '').slice(0, 2).join('').toUpperCase()
    }

    function shortName(name: string): string {
      const parts = name.trim().split(' ')
      return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : name
    }

    async function onSignIn() {
      signingIn.value = true
      await msal.signIn()
      signingIn.value = false
    }

    async function onSignOut() {
      clearTree()
      await msal.signOut()
    }

    async function getAuthHeaders(): Promise<Record<string, string>> {
      if (!msalMode.value) return {}
      const token = await msal.acquireTokenSilent()
      if (!token) return {}
      return { Authorization: `Bearer ${token}` }
    }

    const treeStats = computed(() => {
      if (!treeRoot.value) return { totalNodes: 0, copilotCount: 0 }
      function count(n: OrgTreeNode): { total: number; copilot: number } {
        const sub = n.directReports.reduce((a, r) => {
          const c = count(r); return { total: a.total + c.total, copilot: a.copilot + c.copilot }
        }, { total: 0, copilot: 0 })
        return { total: sub.total + 1, copilot: sub.copilot + (n.copilotData ? 1 : 0) }
      }
      const { total, copilot } = count(treeRoot.value)
      return { totalNodes: total, copilotCount: copilot }
    })

    const selectionLabel = computed(() => {
      if (selectedLogins.value.length === 1) return selectedNodeName.value
      return `${selectedNodeName.value} (${selectedLogins.value.length} users)`
    })

    async function onSearchInput(q: string) {
      if (!q || q.length < 2) { searchResults.value = []; return }
      if (searchDebounce) clearTimeout(searchDebounce)
      searchDebounce = setTimeout(async () => {
        searching.value = true
        try {
          const headers = await getAuthHeaders()
          searchResults.value = await $fetch<OrgSearchResult[]>(`/api/org-search?q=${encodeURIComponent(q)}`, { headers })
        } catch { searchResults.value = [] } finally { searching.value = false }
      }, 300)
    }

    async function loadTree(email: string) {
      loadingTree.value = true
      treeError.value = ''
      treeRoot.value = null
      clearSelection()
      try {
        const headers = await getAuthHeaders()
        const res = await $fetch<OrgTreeResponse>(`/api/org-tree?userEmail=${encodeURIComponent(email)}`, { headers })
        mapCopilotDataToTree(res.root, props.userMetrics)
        treeRoot.value = res.root
      } catch (err: unknown) {
        const e = err as { statusMessage?: string }
        treeError.value = e?.statusMessage ?? 'Failed to load org tree'
      } finally {
        loadingTree.value = false
      }
    }

    function onPersonSelected(person: OrgSearchResult | null) {
      if (!person) return
      const email = person.mail ?? person.userPrincipalName
      loadTree(email)
    }

    function clearTree() {
      treeRoot.value = null
      selectedResult.value = null
      searchQuery.value = ''
      clearSelection()
      emit('select', [])
    }

    function clearSelection() {
      selectedLogins.value = []
      selectedNodeName.value = ''
      emit('select', [])
    }

    function onNodeSelect(node: OrgTreeNode) {
      if (
        selectedLogins.value.length > 0 &&
        selectedNodeName.value === node.displayName
      ) {
        // Toggle off
        clearSelection()
        emit('select', [])
        return
      }
      const logins = getSubtreeLogins(node)
      selectedLogins.value = logins
      selectedNodeName.value = node.displayName
      emit('select', logins)
    }

    // Re-enrich tree when userMetrics changes
    watch(() => props.userMetrics, (metrics) => {
      if (treeRoot.value) mapCopilotDataToTree(treeRoot.value, metrics)
    })

    // Auto-load session user's subtree — only when NOT in MSAL mode (MSAL requires explicit sign-in)
    watch(() => props.sessionEmail, (email) => {
      if (email && !treeRoot.value && !msalMode.value) loadTree(email)
    }, { immediate: true })

    return {
      msal, msalMode, signingIn,
      searchQuery, searchResults, selectedResult, searching,
      loadingTree, treeError, treeRoot,
      selectedLogins, selectionLabel, treeStats,
      initials, shortName, onSignIn, onSignOut,
      onSearchInput, onPersonSelected,
      clearTree, clearSelection, onNodeSelect,
    }
  }
})
</script>

<style scoped>
.org-tree-panel {
  height: 100%;
  overflow-y: auto;
  background: transparent;
}
</style>

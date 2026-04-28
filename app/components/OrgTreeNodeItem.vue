<template>
  <div class="org-node">
    <!-- Node row -->
    <div
      class="org-node-row d-flex align-center pa-1 rounded"
      :class="{
        'org-node-selected': isSelected,
        'org-node-root': depth === 0,
      }"
      :style="{ paddingLeft: `${depth * 14 + 4}px` }"
      @click="onRowClick"
    >
      <!-- Expand toggle -->
      <v-btn
        v-if="node.directReports.length > 0"
        size="x-small"
        variant="text"
        icon
        :title="expanded ? 'Collapse' : 'Expand'"
        @click.stop="expanded = !expanded"
      >
        <v-icon size="14">{{ expanded ? 'mdi-chevron-down' : 'mdi-chevron-right' }}</v-icon>
      </v-btn>
      <span v-else style="width: 28px; display: inline-block;" />

      <!-- Avatar -->
      <v-avatar size="24" :color="node.copilotData ? 'primary' : 'grey-lighten-1'" class="mr-2 flex-shrink-0">
        <span class="text-caption font-weight-bold" :class="node.copilotData ? 'text-white' : 'text-grey-darken-2'">
          {{ initials(node.displayName) }}
        </span>
      </v-avatar>

      <!-- Name & title -->
      <div class="flex-grow-1 min-width-0">
        <div
          class="text-caption font-weight-medium text-truncate"
          :class="node.copilotData ? '' : 'text-disabled'"
          :title="node.displayName"
        >
          {{ node.displayName }}
        </div>
        <div v-if="node.jobTitle" class="text-caption text-disabled text-truncate" :title="node.jobTitle" style="font-size: 10px;">
          {{ node.jobTitle }}
        </div>
      </div>

      <!-- Report count badge -->
      <v-chip
        v-if="node.directReports.length > 0"
        size="x-small"
        variant="tonal"
        color="secondary"
        class="flex-shrink-0"
        :title="`${node.directReports.length} direct reports`"
      >
        {{ node.directReports.length }}
      </v-chip>

      <!-- Copilot dot -->
      <v-icon
        v-if="node.copilotData"
        size="10"
        color="success"
        class="ml-1 flex-shrink-0"
        title="Has Copilot data"
      >mdi-circle</v-icon>
      <v-icon
        v-else
        size="10"
        color="grey-lighten-2"
        class="ml-1 flex-shrink-0"
        title="No Copilot data"
      >mdi-circle-outline</v-icon>
    </div>

    <!-- Children -->
    <div v-if="expanded && node.directReports.length > 0">
      <OrgTreeNodeItem
        v-for="child in node.directReports"
        :key="child.id"
        :node="child"
        :depth="depth + 1"
        :selected-logins="selectedLogins"
        @select="$emit('select', $event)"
      />
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, computed } from 'vue'
import type { OrgTreeNode } from '../../shared/types/org-tree'

export default defineComponent({
  name: 'OrgTreeNodeItem',
  props: {
    node: {
      type: Object as () => OrgTreeNode,
      required: true
    },
    depth: {
      type: Number,
      default: 0
    },
    selectedLogins: {
      type: Array as () => string[],
      default: () => []
    }
  },
  emits: ['select'],
  setup(props, { emit }) {
    const expanded = ref(props.depth < 2)

    const isSelected = computed(() => {
      if (props.selectedLogins.length === 0) return false
      if (props.node.githubLogin && props.selectedLogins.includes(props.node.githubLogin)) {
        return true
      }
      // highlight if this node's login is part of the selected set
      return false
    })

    function initials(name: string): string {
      return name.split(' ').map(p => p[0] ?? '').slice(0, 2).join('').toUpperCase()
    }

    function onRowClick() {
      emit('select', props.node)
    }

    return { expanded, isSelected, initials, onRowClick }
  }
})
</script>

<style scoped>
.org-node-row {
  cursor: pointer;
  transition: background 0.1s;
  min-height: 34px;
}
.org-node-row:hover {
  background: rgba(var(--v-theme-primary), 0.08);
}
.org-node-selected {
  background: rgba(var(--v-theme-primary), 0.14) !important;
}
.org-node-root {
  border-bottom: 1px solid rgba(0,0,0,0.06);
  margin-bottom: 2px;
}
.min-width-0 {
  min-width: 0;
}
</style>

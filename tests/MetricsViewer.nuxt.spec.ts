// @vitest-environment nuxt
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, it, expect } from 'vitest'
import { MetricsViewer } from '#components'
import { Metrics } from '@/model/Metrics'

// ── Minimal fixture data ───────────────────────────────────────────────────────

function makeMetrics(day: string, activeUsers = 10): Metrics {
  return new Metrics({
    day,
    total_suggestions_count: 100,
    total_acceptances_count: 80,
    total_lines_suggested: 500,
    total_lines_accepted: 400,
    total_active_users: activeUsers,
    total_chat_acceptances: 20,
    total_chat_turns: 30,
    total_active_chat_users: 5,
    breakdown: [],
  })
}

const sampleMetrics = [
  makeMetrics('2026-04-01', 10),
  makeMetrics('2026-04-02', 12),
]

/**
 * MetricsViewer uses <v-main> which requires Vuetify's layout injection
 * (Symbol(vuetify:layout)) from a parent <v-app>. In unit tests we stub it
 * out so the component content renders without the full layout stack.
 */
const mountOptions = {
  global: {
    stubs: { VMain: { template: '<div class="v-main-stub"><slot /></div>' } },
  },
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('MetricsViewer.vue', () => {
  it('mounts without throwing when metrics is empty', async () => {
    const wrapper = await mountSuspended(MetricsViewer, {
      props: { metrics: [] },
      ...mountOptions,
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('renders the Organization Dashboard heading by default', async () => {
    const wrapper = await mountSuspended(MetricsViewer, {
      props: { metrics: sampleMetrics },
      ...mountOptions,
    })
    expect(wrapper.html()).toContain('Organization Dashboard')
  })

  it('renders a Team Dashboard heading when teamName is set', async () => {
    const wrapper = await mountSuspended(MetricsViewer, {
      props: { metrics: sampleMetrics, teamName: 'the-a-team' },
      ...mountOptions,
    })
    expect(wrapper.html()).toContain('Team Dashboard: the-a-team')
  })

  it('renders learn-more links', async () => {
    const wrapper = await mountSuspended(MetricsViewer, {
      props: { metrics: [] },
      ...mountOptions,
    })
    expect(wrapper.html()).toContain('How metrics are calculated')
    expect(wrapper.html()).toContain('How to interpret this dashboard')
  })
})

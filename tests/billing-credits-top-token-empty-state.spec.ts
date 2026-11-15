// @vitest-environment nuxt
import { mockNuxtImport, mountSuspended } from '@nuxt/test-utils/runtime';
import type { VueWrapper } from '@vue/test-utils';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ref } from 'vue';
import BillingCreditsViewer from '../app/components/BillingCreditsViewer.vue';
import billing from '../public/mock-data/billing-credits.json';

const { useFetchMock } = vi.hoisted(() => ({ useFetchMock: vi.fn() }));
mockNuxtImport('useFetch', () => useFetchMock);

describe('BillingCreditsViewer Top token users empty state', () => {
  let wrapper: VueWrapper;

  afterEach(() => {
    wrapper?.unmount();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  async function renderUsers(users: { login: string; totals_by_cli?: { token_usage: { prompt_tokens_sum: number; output_tokens_sum: number } } }[]) {
    useFetchMock.mockImplementation(async (url: string) => ({
      data: ref(url === '/api/user-metrics' ? users : billing),
      pending: ref(false),
      error: ref(null),
    }));
    vi.stubGlobal('$fetch', vi.fn().mockResolvedValue({
      rows: users.map(user => ({
        user: user.login, tokens: (user.totals_by_cli?.token_usage.prompt_tokens_sum ?? 0) + (user.totals_by_cli?.token_usage.output_tokens_sum ?? 0),
        credits: 0, grossAmount: 0, netAmount: 0, models: 0, billingState: 'loaded',
      })),
      total: users.length, version: 'synthetic', page: 1, itemsPerPage: 25, billingSortAvailable: true,
    }));
    wrapper = await mountSuspended(BillingCreditsViewer, {
      props: { queryParams: { isDataMocked: 'true', githubOrg: 'octodemo' } },
      global: {
        stubs: {
          VMain: { template: '<main><slot /></main>' },
          VDataTable: true,
          Bar: { name: 'Bar', props: ['data'], template: '<canvas />' },
        },
      },
    });
    return wrapper.findAll('.v-card').find(card => card.text().includes('Top token users (CLI, current page)'))!;
  }

  test.each([
    { login: 'monalisa' },
    { login: 'monalisa', totals_by_cli: { token_usage: { prompt_tokens_sum: 0, output_tokens_sum: 0 } } },
  ])('renders accurate guidance for absent or zero CLI tokens: %j', async user => {
    const card = await renderUsers([user]);
    expect(card.get('[data-testid="billing-top-token-users-empty-state"]').text())
      .toBe('No CLI token usage was reported on this page for the selected usage period.');
    expect(card.find('canvas').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('load the User Metrics tab');
  });

  test('renders reported CLI tokens without empty guidance or a User Metrics tab visit', async () => {
    const card = await renderUsers([
      { login: 'monalisa', totals_by_cli: { token_usage: { prompt_tokens_sum: 120, output_tokens_sum: 30 } } },
    ]);
    expect(card.find('[data-testid="billing-top-token-users-empty-state"]').exists()).toBe(false);
    expect(card.getComponent({ name: 'Bar' }).props('data')).toMatchObject({
      labels: ['monalisa'],
      datasets: [{ data: [150] }],
    });
  });
});

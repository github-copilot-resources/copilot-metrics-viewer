// @vitest-environment nuxt
import { mountSuspended, mockNuxtImport } from '@nuxt/test-utils/runtime';
import { flushPromises } from '@vue/test-utils';
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import BillingCreditsViewer from '../app/components/BillingCreditsViewer.vue';

const { mockUseFetch } = vi.hoisted(() => ({ mockUseFetch: vi.fn() }));
mockNuxtImport('useFetch', () => mockUseFetch);

describe('billing aggregate explanations', () => {
  it('renders named native controls with focus and hover explanations for every aggregate', async () => {
    mockUseFetch.mockImplementation((url: string) => Promise.resolve({
      data: ref(url.includes('user-metrics') ? [] : {
        timePeriod: { year: 2026, month: 11 },
        usageItems: [{
          product: 'copilot', sku: 'copilot_ai_credit', model: 'synthetic-model',
          unitType: 'credits', pricePerUnit: 0.1, grossQuantity: 11, grossAmount: 1.1,
          netQuantity: 8, discountQuantity: 2, discountAmount: 0.2, netAmount: 0.9,
        }],
      }),
      pending: ref(false), error: ref(null), refresh: vi.fn(),
    }));
    const wrapper = await mountSuspended(BillingCreditsViewer, {
      attachTo: document.body,
      global: { stubs: { VMain: { template: '<main><slot /></main>' }, Bar: true } },
    });
    try {
      await flushPromises();
      for (const [label, meaning] of [
        ['total credits', 'net billed quantity plus discounted quantity'],
        ['gross cost (usd)', 'list-price USD amount before discounts'],
        ['net cost (usd)', 'USD amount after discounts are applied'],
      ]) {
        const control = wrapper.get(`button[aria-label="About ${label}"]`);
        expect(control.attributes('tabindex')).not.toBe('-1');
        const tooltipId = control.attributes('aria-describedby');
        expect(tooltipId).toBeTruthy();
        // Happy DOM does not track keyboard modality; native Tab is covered in Playwright.
        const matches = control.element.matches.bind(control.element);
        const focusVisible = vi.spyOn(control.element, 'matches').mockImplementation(
          selector => selector === ':focus-visible' || matches(selector),
        );
        (control.element as HTMLButtonElement).focus();
        await vi.waitFor(() => {
          const tooltip = document.getElementById(tooltipId!);
          expect(tooltip?.classList.contains('v-overlay--active')).toBe(true);
          expect(tooltip?.textContent).toContain(meaning);
        });
        await control.trigger('blur');
        focusVisible.mockRestore();
        await vi.waitFor(() => {
          expect(document.getElementById(tooltipId!)?.classList.contains('v-overlay--active')).toBe(false);
        });
        await control.trigger('mouseenter');
        await vi.waitFor(() => {
          expect(document.getElementById(tooltipId!)?.classList.contains('v-overlay--active')).toBe(true);
        });
        await control.trigger('mouseleave');
        await vi.waitFor(() => {
          expect(document.getElementById(tooltipId!)?.classList.contains('v-overlay--active')).toBe(false);
        });
      }
    } finally {
      wrapper.unmount();
      mockUseFetch.mockReset();
    }
  });
});

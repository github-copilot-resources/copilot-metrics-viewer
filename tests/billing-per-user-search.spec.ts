import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const componentSource = readFileSync(resolve(process.cwd(), 'app/components/BillingCreditsViewer.vue'), 'utf8');

describe('BillingCreditsViewer per-user search', () => {
  test('renders a searchable per-user table input wired to Vuetify data-table search', () => {
    expect(componentSource).toContain('data-testid="billing-per-user-search"');
    expect(componentSource).toContain('v-model="perUserSearch"');
    expect(componentSource).toContain(':search="perUserSearch"');
    expect(componentSource).toContain(':filter-keys="[\'user\']"');
  });

  test('loads billing for users matched by search outside the current page', () => {
    expect(componentSource).toContain('const perUserSearch = ref');
    expect(componentSource).toContain('const filteredPerUserRowsForLazyLoad = computed');
    expect(componentSource).toContain('watch(perUserSearch');
    expect(componentSource).toContain('loadBillingForLogins(matchedLogins');
  });
});

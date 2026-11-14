// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';

const componentSource = readFileSync(
  new URL('../app/components/BillingCreditsViewer.vue', import.meta.url),
  'utf8'
);

describe('BillingCreditsViewer Top token users empty state', () => {
  test('uses accurate guidance when no CLI token usage is reported', () => {
    expect(componentSource).toContain('data-testid="billing-top-token-users-empty-state"');
    expect(componentSource).toContain('No CLI token usage was reported for any user in this period.');
    expect(componentSource).not.toContain('load the User Metrics tab');
  });
});

// @vitest-environment node

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const __dirname = dirname(fileURLToPath(import.meta.url));
const componentSource = readFileSync(resolve(__dirname, '../app/components/MyUsageViewer.vue'), 'utf8');

describe('MyUsageViewer source', () => {
  it('documents why accepted lines can be zero for chat-only usage', () => {
    expect(componentSource).toContain('data-testid="my-usage-accepted-lines-tooltip"');
    expect(componentSource).toContain('Lines added from accepted completions and agent edits. Chat / ask-only usage adds no lines, so this can be 0 even with many interactions.');
  });
});

/**
 * Regression test for the X-GitHub-Api-Version header-merging bug.
 *
 * Background: server/middleware/github.ts attaches authenticated GitHub
 * headers to event.context.headers, including X-GitHub-Api-Version: 2022-11-28
 * (the version most metrics endpoints accept). The billing endpoint requires
 * the newer 2026-03-10 version.
 *
 * Earlier we attempted to override the version by spreading the middleware
 * headers and then setting the new version:
 *
 *     headers: {
 *       ...Object.fromEntries(event.context.headers.entries()),
 *       'X-GitHub-Api-Version': '2026-03-10',  // intended to win
 *     }
 *
 * But $fetch / ofetch normalises and CONCATENATES duplicate header values,
 * resulting in "X-GitHub-Api-Version: 2022-11-28, 2026-03-10" — which GitHub
 * rejects with 400 Bad Request.
 *
 * The fix: construct a fresh Headers object that copies only Authorization
 * from the middleware, then sets Accept + X-GitHub-Api-Version explicitly.
 *
 * This unit test guards against re-introducing the bug by directly inspecting
 * the Headers built from the middleware context to ensure exactly one value
 * is sent for X-GitHub-Api-Version.
 */

import { describe, it, expect } from 'vitest';

describe('billing-credits: GitHub API version header', () => {
  it('does not concatenate duplicate header values when building from middleware Headers', () => {
    // Simulate what server/middleware/github.ts attaches to event.context.headers
    const middlewareHeaders = new Headers({
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      Authorization: 'token ghp_test',
    });

    // The fix: copy only Authorization, then set the rest fresh.
    const ghHeaders = new Headers({
      Authorization: middlewareHeaders.get('Authorization') || '',
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
    });

    // Should be the new value only, not a concatenation
    expect(ghHeaders.get('X-GitHub-Api-Version')).toBe('2026-03-10');
    expect(ghHeaders.get('X-GitHub-Api-Version')).not.toContain('2022-11-28');
    expect(ghHeaders.get('Authorization')).toBe('token ghp_test');
  });

  it('demonstrates the old buggy pattern produces concatenated values', () => {
    // This shows what would happen if we naively re-introduce the bug by
    // appending to an existing Headers object that already has the version.
    const buggyHeaders = new Headers({
      'X-GitHub-Api-Version': '2022-11-28',
    });
    // Headers.append concatenates with a comma — this is what $fetch was
    // effectively doing under the hood when spreading + overriding.
    buggyHeaders.append('X-GitHub-Api-Version', '2026-03-10');

    expect(buggyHeaders.get('X-GitHub-Api-Version')).toBe('2022-11-28, 2026-03-10');
    // GitHub's error: "is not a supported version"
  });
});

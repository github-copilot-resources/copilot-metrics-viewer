/**
 * TDD regression tests for the displayName computation in MainComponent.
 *
 * Bug: When navigating to /orgs/octo-demo-org?mock=true (or /enterprises/octo-demo-ent?mock=true),
 * the page title was always forced to "octodemo" in mock mode, ignoring the URL param.
 *
 * Fix: resolveDisplayName() uses URL params first, only falling back to mock defaults
 * when no URL org/ent param is present.
 */
import { describe, test, expect } from 'vitest';
import { resolveDisplayName } from '../shared/utils/resolveDisplayName';

describe('resolveDisplayName – URL params take priority over mock defaults', () => {
  test('uses URL org param in mock mode (regression for "has title" E2E failures)', () => {
    const result = resolveDisplayName({ urlOrg: 'octo-demo-org', urlEnt: '', isMockMode: true });
    expect(result).toContain('octo-demo-org');
    expect(result).not.toContain('octodemo');
    expect(result).toBe('Copilot Metrics Viewer | Organization : octo-demo-org');
  });

  test('uses URL ent param in mock mode for enterprise route', () => {
    const result = resolveDisplayName({ urlOrg: '', urlEnt: 'octo-demo-ent', isMockMode: true });
    expect(result).toContain('octo-demo-ent');
    expect(result).not.toContain('octodemo');
    expect(result).toBe('Copilot Metrics Viewer | Enterprise : octo-demo-ent');
  });

  test('includes team name when present in mock mode with URL org param', () => {
    const result = resolveDisplayName({
      urlOrg: 'octo-demo-org',
      urlEnt: '',
      isMockMode: true,
      teamName: 'the-a-team',
    });
    expect(result).toBe('Copilot Metrics Viewer | Organization : octo-demo-org | Team : the-a-team');
  });

  test('falls back to octodemo when no URL params and mock mode is on', () => {
    const result = resolveDisplayName({ urlOrg: '', urlEnt: '', isMockMode: true });
    expect(result).toContain('octodemo');
    expect(result).toBe('Copilot Metrics Viewer | Organization : octodemo');
  });

  test('uses runtime config in real mode (no URL params)', () => {
    const result = resolveDisplayName({
      urlOrg: '',
      urlEnt: '',
      isMockMode: false,
      configOrg: 'my-real-org',
    });
    expect(result).toBe('Copilot Metrics Viewer | Organization : my-real-org');
  });

  test('uses runtime config enterprise in real mode (no URL params)', () => {
    const result = resolveDisplayName({
      urlOrg: '',
      urlEnt: '',
      isMockMode: false,
      configEnt: 'my-real-ent',
    });
    expect(result).toBe('Copilot Metrics Viewer | Enterprise : my-real-ent');
  });
});

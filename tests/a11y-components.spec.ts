// @vitest-environment nuxt
import { describe, expect, it } from 'vitest';
import { mountSuspended } from '@nuxt/test-utils/runtime';
import { UserMetricsViewer } from '#components';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const componentsDir = join(process.cwd(), 'app/components');

function stripNonVisibleButtonContent(template: string): string {
  let out = template;
  const patterns = [
    /<v-icon\b[\s\S]*?<\/v-icon>/g,
    /<v-tooltip\b[\s\S]*?<\/v-tooltip>/g,
    /<template\b[\s\S]*?<\/template>/g,
    /<[^>]+>/g,
    /{{[\s\S]*?}}/g,
  ];

  for (const pattern of patterns) {
    let prev: string;
    do {
      prev = out;
      out = out.replace(pattern, '');
    } while (out !== prev);
  }

  return out.trim();
}

function findIconOnlyButtonsWithoutAriaLabel(source: string): string[] {
  const failures: string[] = [];
  const buttonPattern = /<v-btn(?![-\w])\b([^>]*?)(?:\/>|>([\s\S]*?)<\/v-btn>)/g;
  for (const match of source.matchAll(buttonPattern)) {
    const attrs = match[1] ?? '';
    const body = match[2] ?? '';
    const hasAriaLabel = /(?:^|\s):?aria-label=/.test(attrs);
    const hasIconProp = /(?:^|\s):?icon(?:\s|=|$)/.test(attrs);
    const hasIconChild = /<v-icon\b/.test(body);
    const hasVisibleText = stripNonVisibleButtonContent(body).length > 0;

    if ((hasIconProp || hasIconChild) && !hasVisibleText && !hasAriaLabel) {
      failures.push(match[0].replace(/\s+/g, ' ').slice(0, 180));
    }
  }
  return failures;
}

describe('component accessibility', () => {
  it('renders the activity filter as a named native toggle and exposes layout selection', async () => {
    const wrapper = await mountSuspended(UserMetricsViewer, {
      props: {
        userMetrics: [{
          login: 'synthetic-user', user_id: 100, total_active_days: 14,
          user_initiated_interaction_count: 10, code_generation_activity_count: 10,
          code_acceptance_activity_count: 5, loc_suggested_to_add_sum: 20,
          loc_suggested_to_delete_sum: 0, loc_added_sum: 10, loc_deleted_sum: 0,
        }],
      },
      global: {
        stubs: {
          VMain: { template: '<div><slot /></div>' },
          Bar: true, Line: true, Doughnut: true,
        },
      },
    });
    try {
      const chip = wrapper.get('button[aria-label^="Activity: High for synthetic-user"]');
      expect(chip.text()).toContain('(High)');
      expect(chip.attributes('aria-pressed')).toBe('false');
      await chip.trigger('click');
      expect(chip.attributes('aria-pressed')).toBe('true');
      expect(wrapper.text()).toContain('synthetic-user — User Insights');
      await chip.trigger('click');
      expect(chip.attributes('aria-pressed')).toBe('false');
      const single = wrapper.get('button[aria-label="Single column layout"]');
      await single.trigger('click');
      expect(single.attributes('aria-pressed')).toBe('true');
      expect(wrapper.get('button[aria-label="Two column layout"]').attributes('aria-pressed')).toBe('false');
    } finally {
      wrapper.unmount();
    }
  });

  it('gives every icon-only v-btn an aria-label', () => {
    const failures = readdirSync(componentsDir)
      .filter(file => file.endsWith('.vue'))
      .flatMap((file) => {
        const source = readFileSync(join(componentsDir, file), 'utf8');
        return findIconOnlyButtonsWithoutAriaLabel(source).map(button => `${file}: ${button}`);
      });

    expect(failures).toEqual([]);
  });

  it('exposes user activity level as a non-color cue on login chips', () => {
    const source = readFileSync(join(componentsDir, 'UserMetricsViewer.vue'), 'utf8');

    expect(source).toContain('getActivityLabel(item.total_active_days)');
    expect(source).toContain('Activity:');
    expect(source).toContain('activity-band-label');
  });
});

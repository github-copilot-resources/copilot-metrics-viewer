import { describe, expect, it } from 'vitest';
import {
  extractChangelogItems,
  isImportantCopilotMetricsChange,
  selectImportantRecentItems,
  buildIssueTitle,
} from '../.github/scripts/copilot-changelog-monitor.mjs';

describe('copilot changelog monitor', () => {
  it('parses rss items from changelog feed xml', () => {
    const xml = `<?xml version="1.0"?>
<rss><channel>
  <item>
    <title><![CDATA[Team-level Copilot usage metrics now available via API]]></title>
    <link>https://github.blog/changelog/2026-05-14-team-level-copilot-usage-metrics-now-available-via-api/</link>
    <pubDate>Thu, 14 May 2026 10:00:00 +0000</pubDate>
    <description><![CDATA[New Copilot metrics report support]]></description>
  </item>
</channel></rss>`;

    const [item] = extractChangelogItems(xml);
    expect(item?.title).toBe('Team-level Copilot usage metrics now available via API');
    expect(item?.link).toContain('github.blog/changelog');
  });

  it('detects important copilot metrics updates', () => {
    expect(isImportantCopilotMetricsChange({
      title: 'Team-level Copilot usage metrics now available via API',
      description: '',
    })).toBe(true);

    expect(isImportantCopilotMetricsChange({
      title: 'Copilot coding agent improvements',
      description: 'Improved coding workflows and bug fixes',
    })).toBe(false);
  });

  it('filters to recent important items and builds issue title', () => {
    const now = new Date('2026-05-20T00:00:00.000Z');
    const selected = selectImportantRecentItems([
      {
        title: 'Copilot usage metrics now include team data',
        description: '',
        pubDate: 'Tue, 19 May 2026 08:00:00 +0000',
        link: 'https://example.com/recent',
      },
      {
        title: 'Copilot usage metrics older update',
        description: '',
        pubDate: 'Tue, 01 Apr 2026 08:00:00 +0000',
        link: 'https://example.com/old',
      },
    ], now, 7);

    expect(selected).toHaveLength(1);
    expect(buildIssueTitle(selected[0]!)).toBe(
      'Copilot metrics changelog update: Copilot usage metrics now include team data',
    );
  });
});

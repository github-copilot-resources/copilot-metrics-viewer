const CHANGELOG_FEED_URL = 'https://github.blog/changelog/feed/';
const ISSUE_TITLE_PREFIX = 'Copilot metrics changelog update:';

export function stripCdata(value = '') {
  return value
    .replace(/^<!\[CDATA\[/, '')
    .replace(/\]\]>$/, '')
    .trim();
}

export function extractTag(itemXml, tagName) {
  const regex = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i');
  const match = itemXml.match(regex);
  return stripCdata(match?.[1] ?? '');
}

export function extractChangelogItems(feedXml) {
  const itemMatches = feedXml.match(/<item>[\s\S]*?<\/item>/gi) ?? [];
  return itemMatches.map((itemXml) => ({
    title: extractTag(itemXml, 'title'),
    link: extractTag(itemXml, 'link'),
    pubDate: extractTag(itemXml, 'pubDate'),
    description: extractTag(itemXml, 'description'),
  }));
}

export function isImportantCopilotMetricsChange(item) {
  const text = `${item.title} ${item.description}`.toLowerCase();
  const hasCopilot = text.includes('copilot');
  const hasMetrics = text.includes('metric');
  return hasCopilot && hasMetrics;
}

export function selectImportantRecentItems(items, now = new Date(), lookbackDays = 7) {
  const minTimestamp = now.getTime() - lookbackDays * 24 * 60 * 60 * 1000;
  return items.filter((item) => {
    if (!isImportantCopilotMetricsChange(item)) return false;
    const publishedAt = Date.parse(item.pubDate);
    return Number.isFinite(publishedAt) && publishedAt >= minTimestamp;
  });
}

export function buildIssueTitle(item) {
  return `${ISSUE_TITLE_PREFIX} ${item.title}`;
}

async function githubApi(method, path, token, body) {
  const response = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${errorText}`);
  }

  return response.json();
}

async function listExistingIssueTitles(owner, repo, token) {
  const issues = await githubApi('GET', `/repos/${owner}/${repo}/issues?state=all&per_page=100`, token);
  return new Set(issues.map((issue) => issue.title));
}

async function createIssue(owner, repo, token, item) {
  const title = buildIssueTitle(item);
  const body = [
    'Automated detection from GitHub Changelog monitor.',
    '',
    `- **Title:** ${item.title}`,
    `- **Published:** ${item.pubDate}`,
    `- **Link:** ${item.link}`,
    '',
    'Please review whether this change requires updates in this repository.',
  ].join('\n');

  await githubApi('POST', `/repos/${owner}/${repo}/issues`, token, { title, body });
  console.log(`Created issue: ${title}`);
}

export async function run() {
  const token = process.env.GITHUB_TOKEN;
  const repository = process.env.GITHUB_REPOSITORY;
  const lookbackDays = Number.parseInt(process.env.CHANGELOG_LOOKBACK_DAYS ?? '7', 10);

  if (!token) throw new Error('Missing required env var: GITHUB_TOKEN');
  if (!repository) throw new Error('Missing required env var: GITHUB_REPOSITORY');

  const [owner, repo] = repository.split('/');
  if (!owner || !repo) throw new Error(`Invalid GITHUB_REPOSITORY value: ${repository}`);

  const feedResponse = await fetch(CHANGELOG_FEED_URL);
  if (!feedResponse.ok) {
    throw new Error(`Failed to fetch changelog feed (${feedResponse.status})`);
  }
  const feedXml = await feedResponse.text();
  const allItems = extractChangelogItems(feedXml);
  const candidates = selectImportantRecentItems(allItems, new Date(), lookbackDays);

  if (candidates.length === 0) {
    console.log('No recent Copilot metrics changelog updates detected.');
    return;
  }

  const existingTitles = await listExistingIssueTitles(owner, repo, token);
  for (const item of candidates) {
    const issueTitle = buildIssueTitle(item);
    if (existingTitles.has(issueTitle)) {
      console.log(`Issue already exists: ${issueTitle}`);
      continue;
    }
    await createIssue(owner, repo, token, item);
    existingTitles.add(issueTitle);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  run().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

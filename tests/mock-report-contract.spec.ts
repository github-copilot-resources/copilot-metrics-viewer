// @vitest-environment node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { downloadReport } from '../server/services/github-copilot-usage-api';

const fixtures = [
  'organization-28-day-report',
  'organization-1-day-report',
  'enterprise-28-day-report',
];
let baseUrl: string;
const server = createServer(async (request, response) => {
  const name = request.url?.slice(1);
  if (!name || !fixtures.includes(name)) {
    response.writeHead(404).end();
    return;
  }
  response.setHeader('content-type', 'application/json');
  response.end(await readFile(new URL(`../public/mock-data/new-api/${name}.json`, import.meta.url)));
});

beforeAll(async () => {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing fixture server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
});
afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
});

describe('mock reports through the HTTP download/parser boundary', () => {
  it.each(fixtures)('preserves documented additional fields in %s without dropping legacy breakdowns', async fixture => {
    const report = await downloadReport(`${baseUrl}/${fixture}`, 'synthetic-scope');
    const day = report.day_totals[0]!;

    expect(day).toMatchObject({
      daily_active_copilot_app_users: expect.any(Number),
      weekly_active_copilot_app_users: expect.any(Number),
      monthly_active_copilot_app_users: expect.any(Number),
      daily_active_local_byok_users: expect.any(Number),
      weekly_active_local_byok_users: expect.any(Number),
      monthly_active_local_byok_users: expect.any(Number),
      below_usage_metrics_minimum_user_count: expect.any(Number),
      missing_client_telemetry_user_count: expect.any(Number),
      distinct_custom_agent_use_count: expect.any(Number),
      distinct_mcp_use_count: expect.any(Number),
      totals_by_mcp: [{ mcp: expect.any(String), interaction_count: expect.any(Number) }],
      totals_by_custom_agent: [{ custom_agent: expect.any(String), interaction_count: expect.any(Number) }],
      totals_by_client: [{
        client: expect.any(String),
        session_count: expect.any(Number),
        request_count: expect.any(Number),
        token_usage: { prompt_tokens_sum: expect.any(Number), output_tokens_sum: expect.any(Number), avg_tokens_per_request: expect.any(Number) },
        totals_by_model: [{
          model: expect.any(String),
          model_selection_mode: expect.any(String),
          is_custom_enterprise_model: expect.any(Boolean),
          request_count: expect.any(Number),
        }],
      }],
      totals_by_copilot_app: { prompt_count: expect.any(Number), request_count: expect.any(Number) },
    });
    expect(day.totals_by_ide.length).toBeGreaterThan(0);
    expect(day.totals_by_feature.length).toBeGreaterThan(0);
    expect(day.totals_by_language_feature.length).toBeGreaterThan(0);
  });
});

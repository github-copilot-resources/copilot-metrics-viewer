// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { buildPerUserBillingLazyLoadRequest } from '../app/utils/billingPerUserLazyLoad';

describe('buildPerUserBillingLazyLoadRequest', () => {
  it('requests rows in the table sort order for client-owned sorts', () => {
    const rows = [
      { user: 'carol', credits: 0, grossAmount: 0, netAmount: 0, tokens: 30, models: 0 },
      { user: 'alice', credits: 0, grossAmount: 0, netAmount: 0, tokens: 10, models: 0 },
      { user: 'bob', credits: 0, grossAmount: 0, netAmount: 0, tokens: 20, models: 0 },
    ];

    const req = buildPerUserBillingLazyLoadRequest(rows, {
      page: 1,
      itemsPerPage: 2,
      sortBy: [{ key: 'tokens', order: 'desc' }],
    });

    expect(req.serverSorted).toBe(false);
    expect(req.logins).toEqual(['carol', 'bob']);
    expect(req.query).toMatchObject({ sortKey: 'tokens', sortOrder: 'desc' });
  });

  it('sends spend sorts to the server so it can return the spend-ordered page', () => {
    const rows = [
      { user: 'alice', credits: 0, grossAmount: 0, netAmount: 0, tokens: 0, models: 0 },
      { user: 'bob', credits: 0, grossAmount: 0, netAmount: 0, tokens: 0, models: 0 },
      { user: 'carol', credits: 0, grossAmount: 0, netAmount: 0, tokens: 0, models: 0 },
    ];

    const req = buildPerUserBillingLazyLoadRequest(rows, {
      page: 1,
      itemsPerPage: 2,
      sortBy: [{ key: 'netAmount', order: 'desc' }],
    });

    expect(req.serverSorted).toBe(true);
    expect(req.logins).toEqual(['alice', 'bob', 'carol']);
    expect(req.query).toEqual({
      page: '1',
      itemsPerPage: '2',
      sortKey: 'netAmount',
      sortOrder: 'desc',
    });
  });
});

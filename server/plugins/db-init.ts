/**
 * Nitro plugin to initialize the PostgreSQL schema on server startup.
 * Only runs when ENABLE_HISTORICAL_MODE is enabled.
 */

import { initSchema } from '../storage/db';

export default defineNitroPlugin(async () => {
  const isHistorical = process.env.ENABLE_HISTORICAL_MODE === 'true';
  if (!isHistorical) return;

  try {
    console.log('Initializing PostgreSQL schema...');
    await initSchema();
    console.log('PostgreSQL schema ready');
  } catch (error) {
    console.error('Failed to initialize PostgreSQL schema:', error);
  }
});

/**
 * Nitro plugin to initialize the PostgreSQL schema on server startup.
 * Runs when ENABLE_HISTORICAL_MODE is enabled or DATABASE_URL is set.
 */

import { initSchema } from '../storage/db';

export default defineNitroPlugin(async () => {
  const isHistorical = process.env.ENABLE_HISTORICAL_MODE === 'true';
  const hasDatabase = !!process.env.DATABASE_URL;
  if (!isHistorical && !hasDatabase) return;

  const maxRetries = 10;
  const baseDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Initializing PostgreSQL schema (attempt ${attempt}/${maxRetries})...`);
      await initSchema();
      console.log('PostgreSQL schema ready');
      return;
    } catch (error: unknown) {
      const pgCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : '';
      const isStartingUp = pgCode === '57P03'; // "the database system is starting up"
      const isConnRefused = (error as Error)?.message?.includes('ECONNREFUSED');

      if ((isStartingUp || isConnRefused) && attempt < maxRetries) {
        const delay = baseDelay * attempt;
        console.log(`PostgreSQL not ready yet, retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        console.error('Failed to initialize PostgreSQL schema:', error);
        return;
      }
    }
  }
});

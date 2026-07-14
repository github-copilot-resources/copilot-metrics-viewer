/**
 * Nitro plugin to initialize the PostgreSQL schema on server startup.
 * Runs when DATABASE_URL is set (historical mode).
 */

import { isDbConfigured } from '../storage/db';
import { createLogger } from '../utils/logger';

const logger = createLogger('db-init');

export default defineNitroPlugin(async () => {
  if (!isDbConfigured()) return;
  const { initSchema } = await import('../storage/db');

  const maxRetries = 10;
  const baseDelay = 2000; // 2 seconds

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.info(`Initializing PostgreSQL schema (attempt ${attempt}/${maxRetries})...`);
      await initSchema();
      logger.info('PostgreSQL schema ready');
      return;
    } catch (error: unknown) {
      const pgCode = error && typeof error === 'object' && 'code' in error ? (error as { code: string }).code : '';
      const isStartingUp = pgCode === '57P03'; // "the database system is starting up"
      const isConnRefused = (error as Error)?.message?.includes('ECONNREFUSED');

      if ((isStartingUp || isConnRefused) && attempt < maxRetries) {
        const delay = baseDelay * attempt;
        logger.warn(`PostgreSQL not ready yet, retrying in ${delay / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logger.error('Failed to initialize PostgreSQL schema:', error);
        return;
      }
    }
  }
});

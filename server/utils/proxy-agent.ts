/**
 * Shared proxy agent initialization utility.
 *
 * Used by:
 *   - server/plugins/http-agent.ts  (Nitro web app)
 *   - server/sync-entry.ts          (standalone sync container)
 *
 * Environment variables:
 *   - HTTP_PROXY:      Optional HTTP/HTTPS proxy URL (e.g. http://proxy:8080)
 *   - CUSTOM_CA_PATH:  Optional path to a custom CA certificate file
 */

import { ProxyAgent, setGlobalDispatcher } from 'undici';
import { readFileSync, existsSync } from 'fs';

/**
 * Initializes a ProxyAgent from environment variables and sets it as the
 * global undici dispatcher so all `$fetch`/`ofetch` calls use the proxy.
 *
 * Returns the created ProxyAgent so callers can wire it into ofetch hooks,
 * or null if HTTP_PROXY is not set.
 *
 * Throws (and exits with code 1 when `exitOnError` is true) if proxy
 * initialization fails — e.g. missing CA file or invalid proxy URL.
 */
export function initializeProxyAgent(exitOnError = false): ProxyAgent | null {
  if (!process.env.HTTP_PROXY) return null;

  try {
    let tlsOptions: { requestTls?: { ca: Buffer[] } } = {};

    if (process.env.CUSTOM_CA_PATH) {
      if (!existsSync(process.env.CUSTOM_CA_PATH)) {
        throw new Error(`CUSTOM_CA_PATH file not found: ${process.env.CUSTOM_CA_PATH}`);
      }
      tlsOptions = { requestTls: { ca: [readFileSync(process.env.CUSTOM_CA_PATH)] } };
    }

    const proxyAgent = new ProxyAgent({
      uri: process.env.HTTP_PROXY!,
      ...tlsOptions
    });

    setGlobalDispatcher(proxyAgent);
    console.info(`[proxy-agent] Proxy initialized: ${process.env.HTTP_PROXY}`);

    return proxyAgent;
  } catch (error) {
    console.error('[proxy-agent] Failed to initialize proxy agent:', error);
    if (exitOnError) process.exit(1);
    throw error;
  }
}

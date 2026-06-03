/**
 * Authentication utilities for standalone sync job.
 * This module provides authentication without requiring an H3Event context.
 */

import { createPrivateKey, createSign } from 'node:crypto';
import { listAppInstallations } from '../modules/github-app-auth';

// ofetch fallback for standalone (non-Nitro) environments.
// In Nitro the global `$fetch` is provided automatically, but this module is
// also loaded by `server/sync-entry.ts` which runs as plain Node via tsx and
// therefore does not have `$fetch` defined. Falling back to the underlying
// `ofetch` package keeps a single call-site that works in both contexts.
import { $fetch as _ofetch } from 'ofetch';
const _fetch: typeof _ofetch = typeof $fetch !== 'undefined' ? ($fetch as typeof _ofetch) : _ofetch;

/**
 * Build a short-lived JWT for GitHub App API calls.
 */
function buildAppJwt(appId: string, privateKey: string): string {
  function b64url(buf: Buffer): string {
    return buf.toString('base64url');
  }
  
  function normalisePem(pem: string): string {
    return pem.replace(/\\n/g, '\n');
  }
  
  function signJWT(payload: Record<string, unknown>, privateKeyPem: string): string {
    const header = b64url(Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
    const body = b64url(Buffer.from(JSON.stringify(payload)));
    const signingInput = `${header}.${body}`;
    
    const key = createPrivateKey({ key: normalisePem(privateKeyPem), format: 'pem' });
    const sign = createSign('RSA-SHA256');
    sign.update(signingInput);
    const sig = sign.sign(key);
    return `${signingInput}.${b64url(sig)}`;
  }
  
  const now = Math.floor(Date.now() / 1000);
  try {
    return signJWT({ iss: appId, iat: now - 10, exp: now + 600 }, privateKey);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Failed to sign GitHub App JWT: ${msg}. ` +
      'Check NUXT_GITHUB_APP_PRIVATE_KEY is a valid PEM-encoded RSA private key.'
    );
  }
}

/**
 * Get a GitHub App installation token for the specified org/enterprise.
 */
async function getGitHubAppTokenForSync(appId: string, privateKey: string, targetOrg: string): Promise<string> {
  const installations = await listAppInstallations(appId, privateKey);
  
  const installation = installations.find(i => i.login.toLowerCase() === targetOrg.toLowerCase());
  if (!installation) {
    throw new Error(
      `GitHub App is not installed on org/enterprise "${targetOrg}". ` +
      `Available: ${installations.map(i => i.login).join(', ')}`
    );
  }
  
  const jwt = buildAppJwt(appId, privateKey);
  const apiBaseUrl = process.env.NUXT_GITHUB_API_BASE_URL || 'https://api.github.com';
  
  const response = await _fetch<{ token: string; expires_at: string }>(
    `${apiBaseUrl}/app/installations/${installation.id}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + jwt,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'copilot-metrics-viewer'
      }
    }
  );
  
  return response.token;
}

/**
 * Get authentication headers for GitHub API.
 * Supports PAT and GitHub App authentication.
 * 
 * @param logger - Logger instance for output
 * @param identifier - GitHub org or enterprise slug
 * @returns GitHub API headers with authentication
 */
export async function getSyncAuthHeaders(logger: Console, identifier: string): Promise<Headers> {
  const githubToken = process.env.NUXT_GITHUB_TOKEN;
  const githubAppId = process.env.NUXT_GITHUB_APP_ID;
  const githubAppPrivateKey = process.env.NUXT_GITHUB_APP_PRIVATE_KEY;
  
  // Try GitHub App authentication first (preferred)
  if (githubAppId && githubAppPrivateKey) {
    logger.info('Using GitHub App authentication');
    const token = await getGitHubAppTokenForSync(githubAppId, githubAppPrivateKey, identifier);
    return new Headers({
      'Authorization': 'Bearer ' + token,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    });
  }
  
  // Fall back to PAT
  if (githubToken) {
    logger.info('Using Personal Access Token authentication');
    return new Headers({
      'Authorization': 'Bearer ' + githubToken,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28'
    });
  }
  
  throw new Error(
    'Authentication required. Configure one of:\n' +
    '  1. GitHub App: set NUXT_GITHUB_APP_ID + NUXT_GITHUB_APP_PRIVATE_KEY\n' +
    '  2. PAT: set NUXT_GITHUB_TOKEN'
  );
}

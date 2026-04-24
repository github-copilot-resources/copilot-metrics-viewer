import type { H3Event, EventHandlerRequest } from 'h3'
import { buildGitHubAppHeaders } from './github-app-auth'

// https://www.telerik.com/blogs/implementing-sso-vue-nuxt-auth-github-comprehensive-guide

/**
 * Authenticates the user and retrieves GitHub headers.
 *
 * Priority order:
 * 1. Mock data — returns a placeholder token
 * 2. GitHub App (NUXT_GITHUB_APP_ID + private key + installation ID) — generates an installation token; works with any OAuth provider
 * 3. Personal Access Token (NUXT_GITHUB_TOKEN) — legacy / simplest setup
 * 4. User's GitHub OAuth token — stored in session after GitHub OAuth login
 *
 * @param {H3Event<EventHandlerRequest>} event - The event object containing the request details.
 * @returns {Promise<Headers>} A promise that resolves to the GitHub headers.
 */
export async function authenticateAndGetGitHubHeaders(event: H3Event<EventHandlerRequest>): Promise<Headers> {
    const config = useRuntimeConfig(event);
    const query = getQuery(event);

    // simple way to check if mock data requested in path
    const dataMocked = query.mock || query.isDataMocked || false;

    if (config.public.isDataMocked || dataMocked) {
        return buildHeaders('mock-token');
    }

    // GitHub App installation token (preferred for decoupled auth — no PAT needed)
    // Requires NUXT_GITHUB_APP_ID (numeric App ID) and NUXT_GITHUB_APP_PRIVATE_KEY
    const githubAppId = config.githubAppId;
    if (githubAppId && config.githubAppPrivateKey) {
        return await buildGitHubAppHeaders(event);
    }

    // Personal Access Token
    if (config.githubToken) {
        return buildHeaders(config.githubToken);
    }

    // User's own GitHub OAuth token (GitHub OAuth login only)
    const { secure } = await getUserSession(event);

    if (secure?.expires_at && secure.expires_at < new Date(Date.now() - 30 * 1000)) {
        return buildHeaders('');
    }

    return buildHeaders(secure?.tokens?.access_token || '');
}

function buildHeaders(token: string): Headers {
    if (!token) {
        throw new Error(
            `Authentication required but not provided. Configure one of:
             1. GitHub App: set NUXT_GITHUB_APP_ID + NUXT_GITHUB_APP_PRIVATE_KEY
             2. PAT: set NUXT_GITHUB_TOKEN
             3. GitHub OAuth: set NUXT_PUBLIC_USING_GITHUB_AUTH=true with client ID/secret`);
    }

    return new Headers({
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `token ${token}`
    });
}


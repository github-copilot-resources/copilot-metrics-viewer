import type { H3Event, EventHandlerRequest } from 'h3'
import { buildGitHubAppHeaders } from './github-app-auth'
import { requireAuthorization } from './authorization'

// https://www.telerik.com/blogs/implementing-sso-vue-nuxt-auth-github-comprehensive-guide

/**
 * Authenticates the user and retrieves GitHub headers.
 * 
 * This function supports multiple authentication schemes:
 * 1. Mocked data (no authentication required)
 * 2. Personal Access Token (NUXT_GITHUB_TOKEN) - legacy mode
 * 3. GitHub App authentication (decoupled from user auth) - new mode
 * 4. User OAuth token (legacy OAuth mode)
 * 
 * When using GitHub App authentication, user authorization is checked separately.
 * 
 * @param {H3Event<EventHandlerRequest>} event - The event object containing the request details.
 * @returns {Promise<Headers>} A promise that resolves to the GitHub headers.
 * 
 * @example
 * const headers = await authenticateAndGetGitHubHeaders(event);
 * 
 * @see https://nuxt.com/docs/guide/recipes/sessions-and-authentication
 */
export async function authenticateAndGetGitHubHeaders(event: H3Event<EventHandlerRequest>): Promise<Headers> {
    const config = useRuntimeConfig(event);
    const query = getQuery(event);

    // simple way to check if mock data requested in path
    const dataMocked = query.mock || query.isDataMocked || false;

    if (config.public.isDataMocked || dataMocked) {
        // when data is mocked, we still need to have a token, but it's not used for real API calls
        return buildHeaders('mock-token');
    }

    // Priority 1: GitHub App authentication (preferred for decoupled auth)
    if (config.githubAppId && config.githubAppPrivateKey && config.githubAppInstallationId) {
        // Check user authorization when using GitHub App
        if (config.public.usingGithubAuth) {
            await requireAuthorization(event);
        }
        return await buildGitHubAppHeaders(event);
    }

    // Priority 2: Personal Access Token (legacy mode)
    if (config.githubToken) {
        return buildHeaders(config.githubToken);
    }

    // Priority 3: User OAuth token (legacy OAuth mode)
    if (config.public.usingGithubAuth) {
        // https://nuxt.com/docs/guide/recipes/sessions-and-authentication
        const { secure } = await getUserSession(event);

        // check if token is expired and get new one
        if (secure?.expires_at && secure.expires_at < new Date(Date.now() - 30 * 1000)) {
            // Token is expired or about to expire within 30 seconds
            // we could refresh but unlikely dashboard is used for long periods
            return buildHeaders('');
        }

        return buildHeaders(secure?.tokens?.access_token || '');
    }

    // No authentication method configured
    throw new Error(
        `Authentication required but not configured.
        Please configure one of the following authentication methods:
        1. GitHub App (recommended): Set NUXT_GITHUB_APP_ID, NUXT_GITHUB_APP_PRIVATE_KEY, and NUXT_GITHUB_APP_INSTALLATION_ID
        2. Personal Access Token: Set NUXT_GITHUB_TOKEN
        3. OAuth: Set NUXT_PUBLIC_USING_GITHUB_AUTH=true with NUXT_OAUTH_GITHUB_CLIENT_ID and NUXT_OAUTH_GITHUB_CLIENT_SECRET`);
}

function buildHeaders(token: string): Headers {
    if (!token) {
        throw new Error(
            `Authentication required but not provided.
            This can happen when:
            1. First call to the API when client checks if user is authenticated - /api/_auth/session.
            2. When App is not configured correctly:
             - For PAT, set NUXT_PUBLIC_GITHUB_TOKEN environment variable.
             - For GitHub Auth - ensure NUXT_PUBLIC_USING_GITHUB_AUTH is set to true, NUXT_OAUTH_GITHUB_CLIENT_ID and NUXT_OAUTH_GITHUB_CLIENT_SECRET are provided and user is authenticated.`);
    }

    return new Headers({
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        Authorization: `token ${token}`
    });
}

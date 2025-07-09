import type { H3Event, EventHandlerRequest } from 'h3'

// https://www.telerik.com/blogs/implementing-sso-vue-nuxt-auth-github-comprehensive-guide

/**
 * Authenticates the user and retrieves GitHub headers.
 * 
 * This function checks if the data is mocked or if a GitHub token is available in the configuration.
 * If neither is available, it requires a user session to obtain a token.
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
    if (config.githubToken) {
        return buildHeaders(config.githubToken);
    }

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

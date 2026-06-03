import { authenticateAndGetGitHubHeaders } from '../modules/authentication';

type Scope = 'org' | 'ent';

/**
 * Returns true if the URL targets the admin sync endpoint (`/api/admin/sync`)
 * and is therefore allowed to bypass the OAuth session check when an
 * `Authorization` header is present. The match is intentionally exact for the
 * path so neighbouring admin routes (e.g. `/api/admin/sync-status`,
 * `/api/admin/syncxyz`) are NOT bypassed.
 */
export function isAdminSyncBypassRoute(url: string): boolean {
    return url === '/api/admin/sync' || url.startsWith('/api/admin/sync?');
}

export default defineEventHandler(async (event) => {

    // get runtime config
    const config = useRuntimeConfig(event);

    event.context.ent = config.public.githubEnt
    event.context.org = config.public.githubOrg
    event.context.team = ''

    if (event.context.org) {
        event.context.scope = 'org' as Scope;
    }
    else if (event.context.ent) {
        event.context.scope = 'ent' as Scope;
    }

    // Only apply authentication to API routes
    const url = event.node.req.url || '';

    const healthCheckPaths = ['/api/health', '/api/live', '/api/ready'];
    // Skip authentication for non-API routes, health checks, auth session, AI chat, and org picker
    if (!url.startsWith('/api/') || healthCheckPaths.includes(url) || url.startsWith('/api/_auth/') || url.startsWith('/api/ai/') || url.startsWith('/api/installations') || url.startsWith('/api/msal/')) {
        return;
    }

    // When OAuth mode is enabled, require a valid user session for all API calls
    // EXCEPT for /api/admin/sync which supports pass-through authentication
    const requireAuth = config.public.requireAuth || config.public.usingGithubAuth || config.public.isPublicApp || !!config.public.authProviders;
    if (requireAuth) {
        // Allow /api/admin/sync to bypass session check if it has an Authorization header.
        // The match is intentionally tight: `/api/admin/sync` exactly, or with a query
        // string. Anything else under `/api/admin/sync*` (e.g. `/api/admin/sync-status`)
        // is NOT bypassed and continues to require a valid user session.
        const authHeader = event.node.req.headers['authorization'];
        const isAdminSync = isAdminSyncBypassRoute(url);
        
        if (isAdminSync && authHeader) {
            // Pass-through auth: use the provided Authorization header directly
            event.context.headers = new Headers({
                'Authorization': authHeader,
                'Accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28'
            });
            return;
        }
        
        // For all other routes, require a valid user session
        const session = await getUserSession(event).catch(() => null);
        if (!session?.user) {
            throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }
    }

    // When historical mode is enabled, metrics come from DB — auth is optional
    // (the handler will request auth only if it needs to sync from the API)
    const historicalMode = process.env.ENABLE_HISTORICAL_MODE === 'true';
    if (historicalMode && (url.startsWith('/api/metrics') || url.startsWith('/api/seats') || url.startsWith('/api/user-metrics'))) {
        try {
            event.context.headers = await authenticateAndGetGitHubHeaders(event);
        } catch {
            // No auth available — that's fine, the handler will use DB
            event.context.headers = new Headers();
        }
        return;
    }

    // get github headers - this also authenticates the user 
    // and throws exception when authentication is required but not provided
    event.context.headers = await authenticateAndGetGitHubHeaders(event);
})
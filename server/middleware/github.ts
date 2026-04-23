import { authenticateAndGetGitHubHeaders } from '../modules/authentication';

type Scope = 'org' | 'ent';

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
    if (!url.startsWith('/api/') || healthCheckPaths.includes(url) || url.startsWith('/api/_auth/') || url.startsWith('/api/ai/') || url.startsWith('/api/installations')) {
        return;
    }

    // When OAuth mode is enabled, require a valid user session for all API calls
    const requireAuth = config.public.requireAuth || config.public.usingGithubAuth;
    if (requireAuth) {
        const session = await getUserSession(event).catch(() => null);
        if (!session?.user) {
            throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
        }
    }

    // Public/marketplace app authorization: when no default org is configured, every API
    // request must be for an org the authenticated user is actually a member of.
    // session.organizations is populated at GitHub OAuth login via /user/installations and
    // contains only orgs the user has access to. Non-GitHub OAuth users (Google, etc.) get
    // an empty list, so they cannot access any org data without a GitHub identity.
    if (config.public.isPublicApp && !config.public.githubOrg && !config.public.githubEnt) {
        const session = await getUserSession(event).catch(() => null);
        const allowedOrgs: string[] = (session as { organizations?: string[] } | null)?.organizations ?? [];
        const query = getQuery(event);
        const requestedOrg = (query.githubOrg || query.githubEnt) as string | undefined;

        if (requestedOrg && !allowedOrgs.includes(requestedOrg)) {
            throw createError({
                statusCode: 403,
                statusMessage: `Access denied: you are not authorized to access organization '${requestedOrg}'. Sign in with GitHub to verify your membership.`
            });
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
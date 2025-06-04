import { authenticateAndGetGitHubHeaders } from '../modules/authentication';

type Scope = 'org' | 'team' | 'ent';

export default defineEventHandler(async (event) => {
    // get runtime config
    const config = useRuntimeConfig(event);

    // get github headers - this also authenticates the user 
    // and throws exception when authentication is required but not provided
    event.context.headers = await authenticateAndGetGitHubHeaders(event);

    console.log(`🔵 [SERVER] config got in github.ts(Middleware):`, {
        githubEnt: config.public.githubEnt,
        githubOrg: config.public.githubOrg,
        githubTeam: config.public.githubTeam,
        scope: config.public.scope,
        isDataMocked: config.public.isDataMocked,
        usingGithubAuth: config.public.usingGithubAuth
    });

    event.context.ent = config.public.githubEnt
    event.context.org = config.public.githubOrg
    event.context.team = config.public.githubTeam

    if (event.context.team && event.context.org) {
        event.context.scope = 'team' as Scope;
    }
    else if (event.context.org) {
        event.context.scope = 'org' as Scope;
    }
    else if (event.context.ent) {
        event.context.scope = 'ent' as Scope;
    }
})
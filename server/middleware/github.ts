import { authenticateAndGetGitHubHeaders } from '../modules/authentication';

type Scope = 'org' | 'team' | 'ent';

export default defineEventHandler(async (event) => {
    // get runtime config
    const config = useRuntimeConfig(event);

    // get github headers - this also authenticates the user 
    // and throws exception when authentication is required but not provided
    event.context.headers = await authenticateAndGetGitHubHeaders(event);

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
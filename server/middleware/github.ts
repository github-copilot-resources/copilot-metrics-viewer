import { authenticateAndGetGitHubHeaders } from '../modules/authentication';

type Scope = 'org' | 'team' | 'ent';

export default defineEventHandler(async (event) => {
    // get runtime config
    const config = useRuntimeConfig(event);

    // get github headers - this also authenticates the user 
    // and throws exception when authentication is required but not provided
    event.context.headers = await authenticateAndGetGitHubHeaders(event);
    
    // Get query parameters (these would override config values)
    const query = getQuery(event);
    
    // Set context values prioritizing query parameters over config values
    event.context.ent = (query.ent as string) || config.public.githubEnt;
    event.context.org = (query.org as string) || config.public.githubOrg;
    event.context.team = (query.team as string) || config.public.githubTeam;
    
    // Log the values we're using
    console.debug('Middleware using values:', {
        ent: event.context.ent,
        org: event.context.org,
        team: event.context.team,
        fromQuery: {
            ent: query.ent,
            org: query.org,
            team: query.team
        }
    });

    // Set the scope based on the values
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
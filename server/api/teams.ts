import { defineEventHandler, getQuery } from 'h3';
import { useRuntimeConfig } from '#imports';

/**
 * Fetches a list of teams for a given organization.
 *
 * This function retrieves team information either from the runtime configuration
 * or by making a request to the GitHub API. If a specific organization parameter
 * is provided, it will use that; otherwise, it defaults to the organization
 * specified in the runtime configuration.
 *
 * @param event - The event object containing context and headers.
 * @param organizationParam - (Optional) The name of the organization to fetch teams for.
 * @returns A promise that resolves to an array of team objects, each containing:
 *          - `name`: The name of the team.
 *          - `slug`: A URL-friendly slug for the team.
 *
 * @throws Will throw an error if the GitHub API response is invalid or if there is
 *         an issue during the fetch process.
 */
export default defineEventHandler(async (event) => {
    try {
        // Extract organization from query parameters
        const query = getQuery(event);
        const organization = query.organization as string;
        const teams = query.teams as string;
       // console.log('query is ', query);
        
        // Pass organization and teams to getTeams function
        const teamsData = await getTeams(event, organization, teams);

        return teamsData;
    } catch (error) {
        console.error('Error in teams.get handler:', error);
        throw error;
    }
});

export const getTeams = async (event: any, organizationParam?: string, teams?: string): Promise<{ name: string; slug: string }[]> => {
    const config = useRuntimeConfig(event);
    // console.log('event is ', event);
    // console.log('event.context is ', event.context);
    // console.log('config public in teams is ', config.public);
    // console.log('fetching teams for org...' + organizationParam);
    // console.log('fetching teams for teams...' + teams);
    //  Use provided organization parameter if available， otherwise fallback to config
    const orgName = organizationParam || config.public.githubOrg;
    //const teamNames = teams || config.public.githubTeam;
    const teamNames = teams ?? config.public.githubTeam;

    // console.log(`Getting teams for organization: ${orgName}`);
    // console.log('team names are ', teamNames);


    if (!teamNames) {
        console.warn('No team names provided, fetching all teams for organization:', orgName);
    }

    // console.log('teams here is ', config.public.githubTeam);
    // console.log('team from event is ', event.context.team);
    
    try {
        // If teams are configured in config, use them directly
        if (teamNames && teamNames.trim() !== '') {
            return await Promise.all(teamNames.split(',').map(async team => ({
                name: team.trim(),
                slug: (await getTeamSlugByName(event, team.trim(), orgName)) || team.trim().toLowerCase().replace(/\s+/g, '-')
            })));
        }

        // Fetch teams from GitHub API
        const response = await $fetch(`https://api.github.com/orgs/${orgName}/teams`, {
            headers: event.context.headers
        }) as any[];

        if (!Array.isArray(response)) {
            throw new Error('Invalid response format from GitHub API');
        }
        
        const teams = response.map((team: any) => ({
            name: team.name || team.slug,
            slug: team.slug || team.name?.toLowerCase().replace(/\s+/g, '-')
        }));
        // console.log("Teams fetched:", teams.map(team => `${team.name},${team.slug}`));
       // console.log('teams got are ', teams);
        return teams;
    } catch (error: any) {
        // console.error('Error fetching teams:', error.message);
        throw error;
    }
};


/**
 * Retrieves the slug for a specified team within a GitHub organization.
 *
 * @param event - The event object containing the runtime context and headers.
 * @param teamName - The name of the team to retrieve the slug for.
 * @param organizationParam - (Optional) The name of the organization. If not provided, the default organization
 *                             from the runtime configuration will be used.
 * @returns A promise that resolves to the team's slug as a string, or `null` if the team is not found.
 * @throws An error if the GitHub API response is invalid or if there is an issue during the fetch operation.
 */
export const getTeamSlugByName = async (event: any, teamName: string, organizationParam?: string): Promise<string | null> => {
   const config = useRuntimeConfig(event);
   const orgName = organizationParam || config.public.githubOrg;
   
  // console.log('team name in getTeamslugbyname is ', teamName);
   // console.log(`Getting slug for team: ${teamName} in organization: ${orgName}`);
    
    try {
        // Fetch teams from github API by specifying the organization name and team name    
        const response = await $fetch(`https://api.github.com/orgs/${orgName}/teams`, {
            headers: event.context.headers
        }) as any[];

        if (!Array.isArray(response)) {
            throw new Error('Invalid response format from GitHub API');
        }
        // console.log('response in getTeamSlugByName is ', response);
        // console.log('team name in getTeamslugbyname is ', teamName);
        // Find team by name (case insensitive)
        // Generated by Zhuang
        const team = response.find((team: any) => team.name.toLowerCase() === teamName.toLowerCase());
        if (team) {
            // console.log(`Found team: ${team.name} with slug: ${team.slug}`);
            // Return the slug or generate one from the name if slug is not available
            return team.slug || team.name?.toLowerCase().replace(/\s+/g, '-');
        } else {
            // console.warn(`Team ${teamName} not found in organization ${orgName}`);
            return null;
        }
    } catch (error: any) {
        // console.error('Error fetching teams:', error.message);
        throw error;
    }
};
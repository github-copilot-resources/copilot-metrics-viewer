export const getTeams = async (event: any): Promise<{ name: string; slug: string }[]> => {
    const config = useRuntimeConfig(event);
    try {
        // If teams are configured in config, use them directly
        if (config.public.githubTeam && config.public.githubTeam.trim() !== '') {
            return config.public.githubTeam.split(',').map(team => ({
                name: team.trim(),
                slug: team.trim().toLowerCase().replace(/\s+/g, '-')
            }));
        }

        // Fetch teams from GitHub API
        const response = await $fetch(`https://api.github.com/orgs/${config.public.githubOrg}/teams`, {
            headers: event.context.headers
        }) as any[];

        if (!Array.isArray(response)) {
            throw new Error('Invalid response format from GitHub API');
        }
        
        const teams = response.map((team: any) => ({
            name: team.name || team.slug,
            slug: team.slug || team.name?.toLowerCase().replace(/\s+/g, '-')
        }));
        console.log("Teams fetched:", teams.map(team => team.name));
        return teams;
    } catch (error: any) {
        console.error('Error fetching teams:', error.message);
        throw error;
    }
};

export const getTeamMetricsApi = async (event: any): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
    try {
        const teams = await getTeams(event);
        if (!teams.length) {
            console.warn('No teams available');
            return { metrics: [], original: [], teamMetrics: [] };
        }

        return await getMultipleTeamsMetricsApi(event, teams.map(team => team.name));
    } catch (error) {
        console.error('Error fetching team metrics:', error);
        throw error;
    }
};

export const getMultipleTeamsMetricsApi = async (event: any, teams: string[]): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
    const config = useRuntimeConfig(event);
    const allMetrics: Metrics[] = [];
    const allOriginalData: CopilotMetrics[] = [];
    const teamMetrics: { team: string, metrics: Metrics[] }[] = [];

    if (!teams.length) {
        return { metrics: [], original: [], teamMetrics: [] };
    }

    try {
        // First get team slugs
        const teamsWithSlugs = await getTeams(event);
        const teamMap = new Map(teamsWithSlugs.map(team => [team.name, team.slug]));

        for (const team of teams) {
            try {
                console.log(`Fetching metrics for team: ${team}`);
                const teamSlug = teamMap.get(team) || team.toLowerCase().replace(/\s+/g, '-');
                const apiUrl = `https://api.github.com/orgs/${config.public.githubOrg}/teams/${teamSlug}/copilot/metrics`;

                console.log(`Attempting to fetch metrics using URL: ${apiUrl}`);
                const response = await $fetch(apiUrl, {
                    headers: event.context.headers
                }) as unknown[];

                if (response) {
                    const originalData = ensureCopilotMetrics(response);
                    const metricsData = convertToMetrics(originalData);
                    
                    if (metricsData && metricsData.length > 0) {
                        teamMetrics.push({ team, metrics: metricsData });
                        allMetrics.push(...metricsData);
                        allOriginalData.push(...originalData);
                        console.log(`Successfully processed metrics for team ${team}`);
                    } else {
                        console.warn(`No metrics data found for team ${team}`);
                    }
                }
            } catch (error: any) {
                console.error(`Error fetching metrics for team ${team}:`, error);
                // Continue with other teams even if one fails
            }
        }

        // Sort teams by name for consistent display
        teamMetrics.sort((a, b) => a.team.localeCompare(b.team));
        
        console.log('Teams metrics summary:', {
            totalTeams: teamMetrics.length,
            totalDays: allMetrics.length,
            teamsProcessed: teamMetrics.map(tm => ({
                team: tm.team,
                daysOfData: tm.metrics.length
            }))
        });

        return { metrics: allMetrics, original: allOriginalData, teamMetrics };
    } catch (error) {
        console.error('Error in getMultipleTeamsMetricsApi:', error);
        throw error;
    }
};
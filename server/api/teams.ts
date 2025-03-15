export const getTeams = async (): Promise<{ name: string; slug: string }[]> => {
    try {
      // If teams are configured in config, use them directly
      if (config.github.team && config.github.team.trim() !== '') {
        return config.github.team.split(',').map(team => ({
          name: team.trim(),
          slug: team.trim().toLowerCase().replace(/\s+/g, '-')
        }));
      }
  
      // Fetch teams from GitHub API
      const response = await axios.get(`${config.github.apiUrl}/teams`, {
        headers
      });
  
      if (!Array.isArray(response.data)) {
        throw new Error('Invalid response format from GitHub API');
      }
      
      const teams = response.data.map((team: any) => ({
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
  
  export const getTeamMetricsApi = async (): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
    try {
      const teams = await getTeams();
      if (!teams.length) {
        console.warn('No teams available');
        return { metrics: [], original: [], teamMetrics: [] };
      }
  
      return await getMultipleTeamsMetricsApi(teams.map(team => team.name));
    } catch (error) {
      console.error('Error fetching team metrics:', error);
      throw error;
    }
  };
  
  export const getMultipleTeamsMetricsApi = async (teams: string[]): Promise<{ metrics: Metrics[], original: CopilotMetrics[], teamMetrics: { team: string, metrics: Metrics[] }[] }> => {
    const allMetrics: Metrics[] = [];
    const allOriginalData: CopilotMetrics[] = [];
    const teamMetrics: { team: string, metrics: Metrics[] }[] = [];
  
    if (!teams.length) {
      return { metrics: [], original: [], teamMetrics: [] };
    }
  
    try {
      // First get team slugs
      const teamsWithSlugs = await getTeams();
      const teamMap = new Map(teamsWithSlugs.map(team => [team.name, team.slug]));
  
      for (const team of teams) {
        try {
          console.log(`Fetching metrics for team: ${team}`);
          const teamSlug = teamMap.get(team) || team.toLowerCase().replace(/\s+/g, '-');
          
          // Array of URL formats to try
          const urlFormats = [
            // Format 1: Using team slug directly
            `${config.github.apiUrl}/teams/${teamSlug}/copilot/metrics`,
            // Format 2: Using organization and team slug
            `${config.github.apiUrl}/orgs/${config.github.org}/teams/${teamSlug}/copilot/metrics`,
            // Format 3: Using encoded team name
            `${config.github.apiUrl}/teams/${encodeURIComponent(team)}/copilot/metrics`,
            // Format 4: Using organization and encoded team name
            `${config.github.apiUrl}/orgs/${config.github.org}/teams/${encodeURIComponent(team)}/copilot/metrics`
          ];
  
          let response = null;
          let lastError = null;
  
          // Try each URL format until one works
          for (const url of urlFormats) {
            try {
              console.log(`Attempting to fetch metrics using URL: ${url}`);
              response = await axios.get(url, { headers });
              if (response.status === 200) {
                console.log(`Successfully fetched metrics using URL: ${url}`);
                break;
              }
            } catch (error: any) {
              console.log(`Failed to fetch metrics using URL: ${url}`);
              lastError = error;
              continue;
            }
          }
  
          if (!response && lastError) {
            throw lastError;
          }
  
          if (response && response.data) {
            const originalData = ensureCopilotMetrics(response.data);
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
          console.log(`Status: ${error.response?.status}, Message: ${error.message}`);
          console.log(`Request URL: ${error.config?.url}`);
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
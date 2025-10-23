export default function getDisplayName(input: { githubOrg: string; githubOrgs: string; githubEnt: string; githubTeam: string; scope: string }) {
    const teamName = input.githubTeam && input.githubTeam.trim() !== '' ? `| Team : ${input.githubTeam}` : '';
    
    // Handle multi-organization scope
    if (input.scope === 'multi-organization' && input.githubOrgs) {
        const orgsArray = input.githubOrgs.split(',').map(org => org.trim()).filter(Boolean);
        const orgsList = orgsArray.join(', ');
        return `Copilot Metrics Viewer | Organizations : ${orgsList}`;
    }
    
    const topLevelScope = input.githubEnt ? 'Enterprise' : 'Organization';

    return `Copilot Metrics Viewer | ${topLevelScope} : ${input.githubOrg || input.githubEnt} ${teamName}`;
}

export default function getDisplayName(input: { githubOrg: string; githubEnt: string; scope: string }) {
    const topLevelScope = input.githubEnt ? 'Enterprise' : 'Organization';

    return `Copilot Metrics Viewer | ${topLevelScope} : ${input.githubOrg || input.githubEnt}`;
}

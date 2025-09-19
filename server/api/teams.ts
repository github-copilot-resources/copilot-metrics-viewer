import { Options, type Scope, type EnterpriseType } from '@/model/Options'
import type { H3Event, EventHandlerRequest } from 'h3'

interface Team { name: string; slug: string; description: string }
interface GitHubTeam { name: string; slug: string; description?: string }
interface GitHubOrganization { login: string; id: number }

class TeamsError extends Error {
    statusCode: number
    constructor(message: string, statusCode: number) {
        super(message)
        this.name = 'TeamsError'
        this.statusCode = statusCode
    }
}

function parseLinkHeader(linkHeader: string | null): Record<string, string> {
    const links: Record<string, string> = {}
    if (!linkHeader) return links
    for (const part of linkHeader.split(',')) {
        const section = part.trim()
        const match = section.match(/^<([^>]+)>;\s*rel="([^"]+)"/)
        if (match) {
            const [, url, rel] = match
            links[rel] = url
        }
    }
    return links
}

export default defineEventHandler(async (event) => {
    const logger = console

    try {
        const teamsData = await getTeams(event)
        return teamsData
    } catch (error: unknown) {
        logger.error('Error fetching teams data:', error)
        const errorMessage = error instanceof Error ? error.message : String(error)
        const statusCode = (error && typeof error === 'object' && 'statusCode' in error)
            ? (error as { statusCode: number }).statusCode
            : 500
        return new Response('Error fetching teams data: ' + errorMessage, { status: statusCode })
    }
})

export async function getTeams(event: H3Event<EventHandlerRequest>): Promise<Team[]> {
    const logger = console
    const query = getQuery(event)
    const options = Options.fromQuery(query)
    const config = useRuntimeConfig()

    // Fill missing scope/context from runtime config
    if (!options.scope && config.public.scope) options.scope = config.public.scope as Scope
    if (!options.githubOrg && config.public.githubOrg) options.githubOrg = config.public.githubOrg
    if (!options.githubEnt && config.public.githubEnt) options.githubEnt = config.public.githubEnt
    if (!options.enterpriseType && config.public.enterpriseType) options.enterpriseType = config.public.enterpriseType as EnterpriseType

    if (options.isDataMocked) {
        logger.info('Using mocked data for teams')
        const teams: Team[] = [
            { name: 'The A Team', slug: 'the-a-team', description: 'A team of elite agents' },
            { name: 'Development Team', slug: 'dev-team', description: 'Team responsible for development' },
            { name: 'Frontend Team', slug: 'frontend-team', description: 'Team responsible for frontend development' },
            { name: 'Backend Team', slug: 'backend-team', description: 'Team responsible for backend development' },
            { name: 'QA Team', slug: 'qa-team', description: 'Team responsible for quality assurance' }
        ]
        return teams
    }

    if (!event.context.headers.has('Authorization')) {
        logger.error('No Authentication provided')
        throw new TeamsError('No Authentication provided', 401)
    }

    // Build base URL based on scope
    const baseUrl = options.getTeamsApiUrl()

    const allTeams: Team[] = []
    
    // Handle enterprise scope with different enterprise types
    if ((options.scope === 'enterprise' || options.scope === 'team-enterprise') && options.enterpriseType === 'full') {
        // For full enterprises, we need to enumerate organizations and get teams from each
        const orgsUrl = options.getEnterpriseOrganizationsApiUrl()
        
        logger.info(`Fetching organizations for full enterprise from ${orgsUrl}`)
        let nextOrgsUrl: string | null = `${orgsUrl}?per_page=100`
        let orgsPage = 1
        
        while (nextOrgsUrl) {
            logger.info(`Fetching organizations page ${orgsPage} from ${nextOrgsUrl}`)
            const orgsRes = await $fetch.raw(nextOrgsUrl, {
                headers: event.context.headers
            })
            
            const orgsData = orgsRes._data as GitHubOrganization[]
            
            // For each organization, fetch its teams
            for (const org of orgsData) {
                const orgTeamsUrl = `https://api.github.com/orgs/${org.login}/teams`
                let nextTeamsUrl: string | null = `${orgTeamsUrl}?per_page=100`
                let teamsPage = 1
                
                while (nextTeamsUrl) {
                    logger.info(`Fetching teams page ${teamsPage} from ${nextTeamsUrl} for org ${org.login}`)
                    const teamsRes = await $fetch.raw(nextTeamsUrl, {
                        headers: event.context.headers
                    })
                    
                    const teamsData = teamsRes._data as GitHubTeam[]
                    for (const t of teamsData) {
                        const name: string = `${org.login} - ${t.name}`
                        const slug: string = `${org.login} - ${t.slug}`
                        const description: string = t.description || `Team ${t.name} from organization ${org.login}`
                        if (t.name && t.slug) allTeams.push({ name, slug, description })
                    }
                    
                    const teamsLinkHeader = teamsRes.headers.get('link') || teamsRes.headers.get('Link')
                    const teamsLinks = parseLinkHeader(teamsLinkHeader)
                    nextTeamsUrl = teamsLinks['next'] || null
                    teamsPage += 1
                }
            }
            
            const orgsLinkHeader = orgsRes.headers.get('link') || orgsRes.headers.get('Link')
            const orgsLinks = parseLinkHeader(orgsLinkHeader)
            nextOrgsUrl = orgsLinks['next'] || null
            orgsPage += 1
        }
    } else {
        // Handle organization scope or copilot-only enterprise scope (original logic)
        let nextUrl: string | null = `${baseUrl}?per_page=100`
        let page = 1

        while (nextUrl) {
            logger.info(`Fetching teams page ${page} from ${nextUrl}`)
            const res = await $fetch.raw(nextUrl, {
                headers: event.context.headers
            })

            const data = res._data as GitHubTeam[]
            for (const t of data) {
                const name: string = t.name
                const slug: string = t.slug
                const description: string = t.description || ''
                if (name && slug) allTeams.push({ name, slug, description })
            }

            const linkHeader = res.headers.get('link') || res.headers.get('Link')
            const links = parseLinkHeader(linkHeader)
            nextUrl = links['next'] || null
            page += 1
        }
    }

    return allTeams
}

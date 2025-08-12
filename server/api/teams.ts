import { Options, type Scope } from '@/model/Options'
import type { H3Event, EventHandlerRequest } from 'h3'

interface Team { name: string; slug: string; description: string }
interface GitHubTeam { name: string; slug: string; description?: string }

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

    return allTeams
}

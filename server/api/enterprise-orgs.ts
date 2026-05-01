/**
 * Enterprise Organizations API endpoint
 * GET /api/enterprise-orgs
 *
 * Detects whether an enterprise is a "Full GHEC" enterprise (one with organizations)
 * and returns the list of organizations if so.
 *
 * Used by the Teams tab to show an organization dropdown for Full GHEC enterprises.
 */

import { Options } from '@/model/Options'
import type { Scope } from '@/model/Options'

interface EnterpriseOrg {
    login: string
    name: string
}

interface EnterpriseOrgsResponse {
    isFullGhec: boolean
    orgs: EnterpriseOrg[]
}

interface GraphQLResponse {
    data?: {
        enterprise?: {
            organizations?: {
                totalCount: number
                pageInfo?: {
                    hasNextPage: boolean
                    endCursor: string | null
                }
                nodes: Array<{ login: string; name: string }>
            }
        }
    }
    errors?: Array<{ message: string }>
}

export default defineEventHandler(async (event): Promise<EnterpriseOrgsResponse> => {
    const logger = console
    const query = getQuery(event)
    const options = Options.fromQuery(query)
    const config = useRuntimeConfig()
    const apiBaseUrl = config.githubApiBaseUrl || 'https://api.github.com'

    // Fill missing scope/context from runtime config
    if (!options.scope && config.public.scope) options.scope = config.public.scope as Scope
    if (!options.githubEnt && config.public.githubEnt) options.githubEnt = config.public.githubEnt

    // Mock mode — return sample orgs for development/testing
    if (options.isDataMocked) {
        logger.info('Using mocked data for enterprise-orgs')
        return {
            isFullGhec: true,
            orgs: [
                { login: 'mocked-org', name: 'Mocked Organization' },
                { login: 'another-mocked-org', name: 'Another Mocked Org' },
            ]
        }
    }

    if (!options.githubEnt) {
        throw createError({ statusCode: 400, statusMessage: 'Enterprise slug is required' })
    }

    if (!event.context.headers?.has('Authorization')) {
        logger.error('No Authentication provided for enterprise-orgs endpoint')
        throw createError({ statusCode: 401, statusMessage: 'No Authentication provided' })
    }

    // Build headers from auth middleware
    const fetchHeaders: Record<string, string> = {}
    if (event.context.headers instanceof Headers) {
        for (const [key, value] of event.context.headers.entries()) {
            fetchHeaders[key] = value
        }
    }

    const graphqlQuery = `
        query($ent: String!, $after: String) {
            enterprise(slug: $ent) {
                organizations(first: 100, after: $after) {
                    totalCount
                    pageInfo {
                        hasNextPage
                        endCursor
                    }
                    nodes {
                        login
                        name
                    }
                }
            }
        }
    `

    try {
        const allOrgs: EnterpriseOrg[] = []
        let hasNextPage = true
        let afterCursor: string | null = null
        let isFullGhec = false

        while (hasNextPage) {
            const result = await $fetch<GraphQLResponse>(`${apiBaseUrl}/graphql`, {
                method: 'POST',
                headers: fetchHeaders,
                body: JSON.stringify({
                    query: graphqlQuery,
                    variables: { ent: options.githubEnt, after: afterCursor }
                })
            })

            if (result?.errors?.length) {
                logger.warn('GraphQL errors when fetching enterprise orgs:', result.errors)
                return { isFullGhec: false, orgs: [] }
            }

            const orgsData = result?.data?.enterprise?.organizations
            if (!orgsData) {
                return { isFullGhec: false, orgs: [] }
            }

            // totalCount is only reliable on first page — set isFullGhec on first iteration
            if (afterCursor === null) {
                isFullGhec = orgsData.totalCount > 0
                if (!isFullGhec) {
                    return { isFullGhec: false, orgs: [] }
                }
            }

            for (const n of (orgsData.nodes || [])) {
                allOrgs.push({ login: n.login, name: n.name || n.login })
            }

            hasNextPage = orgsData.pageInfo?.hasNextPage ?? false
            afterCursor = orgsData.pageInfo?.endCursor ?? null
        }

        return { isFullGhec, orgs: allOrgs }
    } catch (error) {
        // If GraphQL call fails (e.g. insufficient permissions), assume not Full GHEC
        logger.warn('Failed to fetch enterprise orgs via GraphQL, assuming Copilot Business Only:', error)
        return { isFullGhec: false, orgs: [] }
    }
})

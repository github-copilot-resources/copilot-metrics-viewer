import type { H3Event } from 'h3'
import { Options } from '@/model/Options'

interface TeamMetrics {
  team: string
  day: string
  acceptance_rate_count: number
  acceptance_rate_lines: number
  total_suggestions: number
  total_acceptances: number
  total_lines_suggested: number
  total_lines_accepted: number
  total_active_users: number
  ide_completions_users: number
  ide_chat_users: number
  github_chat_users: number
  github_pr_users: number
}

function genSeries(days: string[], team: string): TeamMetrics[] {
  return days.map(day => ({
    team,
    day,
    acceptance_rate_count: 70 + Math.random() * 20,
    acceptance_rate_lines: 65 + Math.random() * 25,
    total_suggestions: Math.floor(100 + Math.random() * 200),
    total_acceptances: Math.floor(70 + Math.random() * 150),
    total_lines_suggested: Math.floor(500 + Math.random() * 1000),
    total_lines_accepted: Math.floor(350 + Math.random() * 700),
    total_active_users: Math.floor(10 + Math.random() * 15),
    ide_completions_users: Math.floor(8 + Math.random() * 12),
    ide_chat_users: Math.floor(5 + Math.random() * 8),
    github_chat_users: Math.floor(3 + Math.random() * 6),
    github_pr_users: Math.floor(2 + Math.random() * 5)
  }))
}

export default defineEventHandler(async (event: H3Event) => {
  const logger = console
  const query = getQuery(event)
  const options = Options.fromQuery(query)

  const teamsParam = (query.teams as string | undefined) || ''
  const teams = teamsParam.split(',').map(t => t.trim()).filter(Boolean)

  // Accept optional since/until (YYYY-MM-DD)
  const since = (query.since as string) || undefined
  const until = (query.until as string) || undefined

  // Default last 7 days
  const end = until ? new Date(until) : new Date()
  const start = since ? new Date(since) : new Date(end.getTime() - 6 * 24 * 60 * 60 * 1000)

  const days: string[] = []
  const cur = new Date(start)
  while (cur <= end) {
    days.push(cur.toISOString().split('T')[0])
    cur.setDate(cur.getDate() + 1)
  }

  if (options.isDataMocked) {
    logger.info('Returning mocked team metrics from server')
    const all: TeamMetrics[] = []
    for (const team of teams) {
      all.push(...genSeries(days, team))
    }
    return all
  }

  return new Response('Team metrics endpoint not implemented for live data', { status: 501 })
})

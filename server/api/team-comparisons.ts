import { Options } from '@/model/Options'

interface LanguageTeamData { team: string; language: string; acceptance_rate: number }
interface EditorTeamData { team: string; editor: string; active_users: number }

export default defineEventHandler(async (event) => {
  const logger = console
  const query = getQuery(event)
  const options = Options.fromQuery(query)

  const teamsParam = (query.teams as string | undefined) || ''
  const teams = teamsParam.split(',').map(t => t.trim()).filter(Boolean)

  if (options.isDataMocked) {
    logger.info('Returning mocked team comparison data from server')
    const languages = ['TypeScript', 'JavaScript', 'Python', 'Java', 'Go']
    const editors = ['VS Code', 'IntelliJ IDEA', 'WebStorm', 'PyCharm', 'GoLand']

    const languageData: LanguageTeamData[] = []
    const editorData: EditorTeamData[] = []

    teams.forEach(team => {
      languages.forEach(language => {
        if (Math.random() > 0.3) {
          languageData.push({ team, language, acceptance_rate: 65 + Math.random() * 25 })
        }
      })
      editors.forEach(editor => {
        if (Math.random() > 0.4) {
          editorData.push({ team, editor, active_users: Math.floor(1 + Math.random() * 8) })
        }
      })
    })

    return { languages: languageData, editors: editorData }
  }

  return new Response('Team comparisons endpoint not implemented for live data', { status: 501 })
})

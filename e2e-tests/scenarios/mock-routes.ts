type MockRouteScenario = Readonly<{
  id: string
  owner: string
} & (
  | { scope: 'organization'; team?: never }
  | { scope: 'enterprise'; team?: never }
  | { scope: 'organization-team'; team: string }
  | { scope: 'enterprise-team'; team: string }
)>

// Deliberately distinct from the server's synthetic defaults.
export const mockRouteScenarios = [
  { id: 'organization', scope: 'organization', owner: 'matrix-synthetic-org' },
  { id: 'enterprise', scope: 'enterprise', owner: 'matrix-synthetic-ent' },
  { id: 'organization-team', scope: 'organization-team', owner: 'matrix-synthetic-org', team: 'the-a-team' },
  { id: 'enterprise-team', scope: 'enterprise-team', owner: 'matrix-synthetic-ent', team: 'dev-team' },
] as const satisfies readonly MockRouteScenario[]

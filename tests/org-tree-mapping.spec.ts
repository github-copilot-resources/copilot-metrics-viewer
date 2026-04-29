import { describe, it, expect } from 'vitest'
import { mapCopilotDataToTree, getSubtreeLogins } from '../shared/utils/org-tree-mapping'
import type { OrgTreeNode, UserTotals } from '../shared/types/org-tree'

function makeNode(opts: {
  id: string
  displayName: string
  mail?: string | null
  userPrincipalName?: string
  directReports?: OrgTreeNode[]
}): OrgTreeNode {
  return {
    id: opts.id,
    displayName: opts.displayName,
    mail: opts.mail ?? null,
    userPrincipalName: opts.userPrincipalName ?? `${opts.id}@example.com`,
    jobTitle: null,
    department: null,
    officeLocation: null,
    directReports: opts.directReports ?? [],
    copilotData: null,
    githubLogin: null,
  }
}

function makeUserTotals(login: string): UserTotals {
  return {
    login,
    user_id: 1,
    total_active_days: 10,
    user_initiated_interaction_count: 100,
    code_generation_activity_count: 200,
    code_acceptance_activity_count: 150,
    loc_suggested_to_add_sum: 1000,
    loc_suggested_to_delete_sum: 50,
    loc_added_sum: 800,
    loc_deleted_sum: 30,
  }
}

// ── mapCopilotDataToTree ──────────────────────────────────────────────────────

describe('mapCopilotDataToTree', () => {
  it('matches by email prefix', () => {
    const node = makeNode({ id: '1', displayName: 'Alice', mail: 'alice@example.com' })
    const totals = [makeUserTotals('alice')]
    mapCopilotDataToTree(node, totals)
    expect(node.githubLogin).toBe('alice')
    expect(node.copilotData).toEqual(totals[0])
  })

  it('matches by userPrincipalName prefix when mail is null', () => {
    const node = makeNode({ id: '1', displayName: 'Bob', mail: null, userPrincipalName: 'bob@company.com' })
    const totals = [makeUserTotals('bob')]
    mapCopilotDataToTree(node, totals)
    expect(node.githubLogin).toBe('bob')
    expect(node.copilotData).toEqual(totals[0])
  })

  it('normalizes dots in email prefix', () => {
    const node = makeNode({ id: '1', displayName: 'Alice Chen', mail: 'alice.chen@example.com' })
    const totals = [makeUserTotals('alicechen')]
    mapCopilotDataToTree(node, totals)
    expect(node.githubLogin).toBe('alicechen')
  })

  it('normalizes hyphens in email prefix', () => {
    const node = makeNode({ id: '1', displayName: 'Bob Smith', mail: 'bob-smith@example.com' })
    const totals = [makeUserTotals('bobsmith')]
    mapCopilotDataToTree(node, totals)
    expect(node.githubLogin).toBe('bobsmith')
  })

  it('normalizes hyphens in GitHub login', () => {
    const node = makeNode({ id: '1', displayName: 'Dave', mail: 'dave@example.com' })
    const totals = [makeUserTotals('dave')]
    mapCopilotDataToTree(node, totals)
    expect(node.githubLogin).toBe('dave')
  })

  it('is case-insensitive in matching', () => {
    const node = makeNode({ id: '1', displayName: 'Alice', mail: 'Alice@Example.COM' })
    const totals = [makeUserTotals('alice')]
    mapCopilotDataToTree(node, totals)
    expect(node.githubLogin).toBe('alice')
  })

  it('returns null login and null copilotData when no match', () => {
    const node = makeNode({ id: '1', displayName: 'Unknown', mail: 'unknown@example.com' })
    const totals = [makeUserTotals('alice')]
    mapCopilotDataToTree(node, totals)
    expect(node.githubLogin).toBeNull()
    expect(node.copilotData).toBeNull()
  })

  it('enriches all levels of a tree recursively', () => {
    const child1 = makeNode({ id: '2', displayName: 'Alice', mail: 'alice@example.com' })
    const child2 = makeNode({ id: '3', displayName: 'Bob', mail: 'bob@example.com' })
    const root = makeNode({ id: '1', displayName: 'Root', mail: 'root@example.com', directReports: [child1, child2] })
    const totals = [makeUserTotals('root'), makeUserTotals('alice'), makeUserTotals('bob')]
    mapCopilotDataToTree(root, totals)
    expect(root.githubLogin).toBe('root')
    expect(child1.githubLogin).toBe('alice')
    expect(child2.githubLogin).toBe('bob')
  })

  it('enriches multiple branches independently', () => {
    const leaf1 = makeNode({ id: '3', displayName: 'C', mail: 'c@example.com' })
    const branch1 = makeNode({ id: '2', displayName: 'B', mail: 'b@example.com', directReports: [leaf1] })
    const leaf2 = makeNode({ id: '5', displayName: 'E', mail: 'e@example.com' })
    const branch2 = makeNode({ id: '4', displayName: 'D', mail: 'd@example.com', directReports: [leaf2] })
    const root = makeNode({ id: '1', displayName: 'A', mail: 'a@example.com', directReports: [branch1, branch2] })
    const totals = ['a', 'b', 'c', 'd', 'e'].map(makeUserTotals)
    mapCopilotDataToTree(root, totals)
    expect(root.githubLogin).toBe('a')
    expect(branch1.githubLogin).toBe('b')
    expect(leaf1.githubLogin).toBe('c')
    expect(branch2.githubLogin).toBe('d')
    expect(leaf2.githubLogin).toBe('e')
  })

  it('mutates the node in place and returns it', () => {
    const node = makeNode({ id: '1', displayName: 'Alice', mail: 'alice@example.com' })
    const totals = [makeUserTotals('alice')]
    const result = mapCopilotDataToTree(node, totals)
    expect(result).toBe(node)
  })

  it('handles empty userTotals array gracefully', () => {
    const node = makeNode({ id: '1', displayName: 'Alice', mail: 'alice@example.com' })
    mapCopilotDataToTree(node, [])
    expect(node.githubLogin).toBeNull()
    expect(node.copilotData).toBeNull()
  })
})

// ── getSubtreeLogins ──────────────────────────────────────────────────────────

describe('getSubtreeLogins', () => {
  it('returns empty array for node with no github login', () => {
    const node = makeNode({ id: '1', displayName: 'Unknown' })
    expect(getSubtreeLogins(node)).toEqual([])
  })

  it('returns login for a matched leaf node', () => {
    const node = makeNode({ id: '1', displayName: 'Alice' })
    node.githubLogin = 'alice'
    expect(getSubtreeLogins(node)).toEqual(['alice'])
  })

  it('collects matched logins from root and all children', () => {
    const child1 = makeNode({ id: '2', displayName: 'Bob' })
    child1.githubLogin = 'bob'
    const child2 = makeNode({ id: '3', displayName: 'No login' })
    const root = makeNode({ id: '1', displayName: 'Root', directReports: [child1, child2] })
    root.githubLogin = 'root'
    const logins = getSubtreeLogins(root)
    expect(logins).toContain('root')
    expect(logins).toContain('bob')
    expect(logins).toHaveLength(2)
  })

  it('excludes nodes without a github login', () => {
    const child = makeNode({ id: '2', displayName: 'No login' })
    const root = makeNode({ id: '1', displayName: 'Root', directReports: [child] })
    root.githubLogin = 'root'
    expect(getSubtreeLogins(root)).toEqual(['root'])
  })

  it('handles deep nesting', () => {
    const leaf = makeNode({ id: '3', displayName: 'Leaf' })
    leaf.githubLogin = 'leaf'
    const mid = makeNode({ id: '2', displayName: 'Mid', directReports: [leaf] })
    mid.githubLogin = 'mid'
    const root = makeNode({ id: '1', displayName: 'Root', directReports: [mid] })
    root.githubLogin = 'root'
    expect(getSubtreeLogins(root)).toEqual(['root', 'mid', 'leaf'])
  })

  it('returns empty array for tree with no matched logins', () => {
    const child = makeNode({ id: '2', displayName: 'No match' })
    const root = makeNode({ id: '1', displayName: 'No match either', directReports: [child] })
    expect(getSubtreeLogins(root)).toEqual([])
  })
})

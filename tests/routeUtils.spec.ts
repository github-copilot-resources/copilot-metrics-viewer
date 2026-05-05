import { describe, test, expect } from 'vitest'
import { routeParamStr, buildReportsToUrl } from '../app/utils/routeUtils'

describe('routeParamStr', () => {
  test('returns string param unchanged', () => {
    expect(routeParamStr({ org: 'test-org' }, 'org')).toBe('test-org')
  })

  test('returns first element of array param', () => {
    expect(routeParamStr({ org: ['test-org', 'other'] }, 'org')).toBe('test-org')
  })

  test('returns empty string when key missing', () => {
    expect(routeParamStr({}, 'org')).toBe('')
  })

  test('returns empty string for empty array', () => {
    expect(routeParamStr({ org: [] }, 'org')).toBe('')
  })
})

describe('buildReportsToUrl', () => {
  const encode = (logins: string[]) =>
    btoa(logins.join(',')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  test('returns empty string when upn is empty', () => {
    expect(buildReportsToUrl('', [], '', 'organization', '', 'myorg', 'myent', undefined, encode)).toBe('')
  })

  test('org scope uses githubOrg', () => {
    const url = buildReportsToUrl('boss@org.com', [], '', 'organization', '', 'myorg', 'myent', undefined, encode)
    expect(url).toBe('/orgs/myorg/reportsto/boss%40org.com')
  })

  test('enterprise scope without selectedOrg uses githubEnt', () => {
    const url = buildReportsToUrl('boss@org.com', [], '', 'enterprise', '', 'myorg', 'myent', undefined, encode)
    expect(url).toBe('/enterprises/myent/reportsto/boss%40org.com')
  })

  test('enterprise scope with selectedOrg uses org path', () => {
    const url = buildReportsToUrl('boss@org.com', [], '', 'enterprise', 'selected-org', 'myorg', 'myent', undefined, encode)
    expect(url).toBe('/orgs/selected-org/reportsto/boss%40org.com')
  })

  test('includes ?users= when logins provided', () => {
    const logins = ['monalisa', 'defunkt']
    const url = buildReportsToUrl('boss@org.com', logins, '', 'organization', '', 'myorg', 'myent', undefined, encode)
    expect(url).toContain('users=')
    const qs = new URLSearchParams(url.split('?')[1])
    const decoded = atob(qs.get('users')!.replace(/-/g, '+').replace(/_/g, '/'))
    expect(decoded).toBe('monalisa,defunkt')
  })

  test('includes ?name= when label provided', () => {
    const url = buildReportsToUrl('boss@org.com', [], 'Boss Label', 'organization', '', 'myorg', 'myent', undefined, encode)
    expect(url).toContain('name=Boss+Label')
  })

  test('forwards ?mock= param', () => {
    const url = buildReportsToUrl('boss@org.com', [], '', 'organization', '', 'myorg', 'myent', 'true', encode)
    expect(url).toContain('mock=true')
  })

  test('no query string when no logins, name, or mock', () => {
    const url = buildReportsToUrl('boss@org.com', [], '', 'organization', '', 'myorg', 'myent', undefined, encode)
    expect(url).not.toContain('?')
  })

  test('URL-encodes special chars in upn', () => {
    const url = buildReportsToUrl('boss+alias@org.com', [], '', 'organization', '', 'myorg', 'myent', undefined, encode)
    expect(url).toContain('boss%2Balias%40org.com')
  })

  test('omits ?users= when no encodeLogins function supplied', () => {
    const url = buildReportsToUrl('boss@org.com', ['a', 'b'], 'Test', 'organization', '', 'myorg', 'myent', undefined, undefined)
    expect(url).not.toContain('users=')
    expect(url).toContain('name=Test')
  })
})

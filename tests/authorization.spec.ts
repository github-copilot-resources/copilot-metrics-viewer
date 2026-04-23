import { describe, it, expect } from 'vitest'
import { checkAuthorization } from '../server/utils/authorization'

describe('checkAuthorization', () => {
  describe('when no restrictions are configured', () => {
    it('allows any user with a login', () => {
      expect(checkAuthorization({ login: 'anyone' }, '', '')).toBe(true)
    })

    it('allows any user with an email', () => {
      expect(checkAuthorization({ email: 'user@random.com' }, '', '')).toBe(true)
    })

    it('allows user with no identity info', () => {
      expect(checkAuthorization({}, '', '')).toBe(true)
    })
  })

  describe('NUXT_AUTHORIZED_USERS (login / email list)', () => {
    const users = 'alice, bob, charlie@company.com'

    it('allows a user by exact login match', () => {
      expect(checkAuthorization({ login: 'alice' }, users, '')).toBe(true)
    })

    it('allows a user by login match (case-insensitive)', () => {
      expect(checkAuthorization({ login: 'ALICE' }, users, '')).toBe(true)
    })

    it('allows a user by email match', () => {
      expect(checkAuthorization({ email: 'charlie@company.com' }, users, '')).toBe(true)
    })

    it('allows a user by email match (case-insensitive)', () => {
      expect(checkAuthorization({ email: 'CHARLIE@COMPANY.COM' }, users, '')).toBe(true)
    })

    it('denies a user not in the list', () => {
      expect(checkAuthorization({ login: 'dave' }, users, '')).toBe(false)
    })

    it('denies a user with unknown email', () => {
      expect(checkAuthorization({ email: 'unknown@other.com' }, users, '')).toBe(false)
    })

    it('denies a user with neither login nor email', () => {
      expect(checkAuthorization({}, users, '')).toBe(false)
    })
  })

  describe('NUXT_AUTHORIZED_EMAIL_DOMAINS', () => {
    const domains = 'company.com, corp.org'

    it('allows a user whose email matches the domain', () => {
      expect(checkAuthorization({ email: 'alice@company.com' }, '', domains)).toBe(true)
    })

    it('allows a user matching the second listed domain', () => {
      expect(checkAuthorization({ email: 'bob@corp.org' }, '', domains)).toBe(true)
    })

    it('allows domain match with leading @ in config (defensive)', () => {
      expect(checkAuthorization({ email: 'user@company.com' }, '', '@company.com')).toBe(true)
    })

    it('denies a user from an unlisted domain', () => {
      expect(checkAuthorization({ email: 'eve@evil.com' }, '', domains)).toBe(false)
    })

    it('denies a user with no email when domain list is set', () => {
      expect(checkAuthorization({ login: 'alice' }, '', domains)).toBe(false)
    })
  })

  describe('combined NUXT_AUTHORIZED_USERS + NUXT_AUTHORIZED_EMAIL_DOMAINS', () => {
    const users = 'admin'
    const domains = 'company.com'

    it('allows an explicitly listed user', () => {
      expect(checkAuthorization({ login: 'admin' }, users, domains)).toBe(true)
    })

    it('allows a user from the allowed domain', () => {
      expect(checkAuthorization({ email: 'alice@company.com' }, users, domains)).toBe(true)
    })

    it('denies a user who matches neither rule', () => {
      expect(checkAuthorization({ login: 'eve', email: 'eve@other.com' }, users, domains)).toBe(false)
    })
  })
})


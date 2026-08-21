import { describe, expect, it } from 'vitest'
import { decodeGoogleIdentity, isAccessTokenUsable } from '../src/services/googleAuth.ts'

function createCredential(claims: object): string {
  const encoded = btoa(JSON.stringify(claims))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  return `header.${encoded}.signature`
}

describe('Google identity credentials', () => {
  it('extracts the UI identity from an ID token payload', () => {
    expect(
      decodeGoogleIdentity(
        createCredential({
          sub: 'google-user-id',
          email: 'reader@example.com',
          name: 'Shelf Reader',
          picture: 'https://example.com/avatar.jpg',
        }),
      ),
    ).toEqual({
      subject: 'google-user-id',
      email: 'reader@example.com',
      name: 'Shelf Reader',
      picture: 'https://example.com/avatar.jpg',
    })
  })

  it('rejects malformed or incomplete identity credentials', () => {
    expect(() => decodeGoogleIdentity('not-a-jwt')).toThrow('invalid identity credential')
    expect(() => decodeGoogleIdentity(createCredential({ sub: 'google-user-id' }))).toThrow(
      'incomplete identity information',
    )
  })
})

describe('Google authentication state', () => {
  it('requires an access token and more than one minute before expiry', () => {
    const now = 1_000_000

    expect(isAccessTokenUsable(null, now + 120_000, now)).toBe(false)
    expect(isAccessTokenUsable('access-token', now + 60_000, now)).toBe(false)
    expect(isAccessTokenUsable('access-token', now + 60_001, now)).toBe(true)
  })
})

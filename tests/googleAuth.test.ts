import { describe, expect, it } from 'vitest'
import { decodeGoogleIdentity } from '../src/services/googleAuth.ts'

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

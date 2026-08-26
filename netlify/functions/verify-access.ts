import type { Handler, HandlerEvent } from '@netlify/functions'

const GOOGLE_TOKEN_INFO_URL = 'https://oauth2.googleapis.com/tokeninfo'

interface GoogleTokenInfo {
  aud?: string
  email?: string
}

export const handler: Handler = async (event: HandlerEvent) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' }
  }

  let idToken: string
  try {
    const body = JSON.parse(event.body ?? '{}') as Record<string, unknown>
    if (typeof body.idToken !== 'string' || !body.idToken) throw new Error()
    idToken = body.idToken
  } catch {
    return { statusCode: 400, body: JSON.stringify({ error: 'Missing idToken' }) }
  }

  try {
    const res = await fetch(`${GOOGLE_TOKEN_INFO_URL}?id_token=${encodeURIComponent(idToken)}`)

    if (!res.ok) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token' }) }
    }

    const tokenInfo = (await res.json()) as GoogleTokenInfo

    if (tokenInfo.aud !== process.env.VITE_GOOGLE_CLIENT_ID) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Invalid token audience' }) }
    }

    if (!tokenInfo.email) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Token missing email' }) }
    }

    const allowedEmails = (process.env.ALLOWED_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)

    if (allowedEmails.length > 0 && !allowedEmails.includes(tokenInfo.email.toLowerCase())) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: 'Your account is not authorized to access this application.' }),
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowed: true }),
    }
  } catch {
    return { statusCode: 500, body: JSON.stringify({ error: 'Verification failed.' }) }
  }
}

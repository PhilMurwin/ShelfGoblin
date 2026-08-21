import { reactive, readonly } from 'vue'

export const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'

export interface GoogleIdentity {
  subject: string
  email: string
  name: string
  picture?: string
}

interface GoogleCredentialResponse {
  credential: string
}

interface GoogleTokenResponse {
  access_token?: string
  expires_in?: number
  error?: string
  error_description?: string
}

interface GoogleTokenClient {
  requestAccessToken: (options?: { hint?: string; prompt?: string }) => void
}

interface GoogleIdentityServices {
  accounts: {
    id: {
      initialize: (configuration: {
        client_id: string
        callback: (response: GoogleCredentialResponse) => void
        auto_select?: boolean
        use_fedcm_for_button?: boolean
        button_auto_select?: boolean
      }) => void
      renderButton: (
        element: HTMLElement,
        options: Record<string, string | number | boolean>,
      ) => void
      prompt: () => void
      disableAutoSelect: () => void
    }
    oauth2: {
      initTokenClient: (configuration: {
        client_id: string
        scope: string
        callback: (response: GoogleTokenResponse) => void
      }) => GoogleTokenClient
    }
  }
}

declare global {
  interface Window {
    google?: GoogleIdentityServices
  }
}

interface AuthState {
  initialized: boolean
  loading: boolean
  error: string | null
  user: GoogleIdentity | null
  accessToken: string | null
  accessTokenExpiresAt: number | null
}

const state = reactive<AuthState>({
  initialized: false,
  loading: false,
  error: null,
  user: null,
  accessToken: null,
  accessTokenExpiresAt: null,
})

let googleLibrary: Promise<GoogleIdentityServices> | null = null
let configuredClientId: string | null = null

export const authState = readonly(state)

export function decodeGoogleIdentity(credential: string): GoogleIdentity {
  const payload = credential.split('.')[1]

  if (!payload) {
    throw new Error('Google returned an invalid identity credential.')
  }

  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))

    if (!isGoogleIdentityClaims(claims)) {
      throw new Error('Google returned incomplete identity information.')
    }

    return {
      subject: claims.sub,
      email: claims.email,
      name: typeof claims.name === 'string' ? claims.name : claims.email,
      picture: claims.picture,
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }

    throw new Error('Google returned an invalid identity credential.')
  }
}

export function hasUsableAccessToken(now = Date.now()): boolean {
  return isAccessTokenUsable(state.accessToken, state.accessTokenExpiresAt, now)
}

export function isAccessTokenUsable(
  accessToken: string | null,
  expiresAt: number | null,
  now = Date.now(),
): boolean {
  return Boolean(accessToken && expiresAt && expiresAt > now + 60_000)
}

/**
 * Renders Google's own sign-in button. Google Sheets consent is intentionally
 * deferred until a Sheets action calls getAccessToken from a user gesture.
 */
export async function renderGoogleSignInButton(element: HTMLElement): Promise<void> {
  const clientId = getClientId()
  const google = await loadGoogleIdentityServices()

  configuredClientId = clientId
  google.accounts.id.initialize({
    client_id: clientId,
    // One Tap can automatically return a credential for a previously
    // authorized account when Google's privacy and browser conditions allow it.
    auto_select: true,
    // Use the current FedCM button flow and its supported returning-user
    // automatic selection behavior where the browser supports it.
    use_fedcm_for_button: true,
    button_auto_select: true,
    callback: (response) => {
      void handleIdentityCredential(response)
    },
  })

  element.replaceChildren()
  google.accounts.id.renderButton(element, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
  })
  // The button is the explicit fallback; One Tap is what enables an
  // automatic sign-in attempt on a later visit without a button click.
  google.accounts.id.prompt()
  state.initialized = true
}

/**
 * Returns a non-expired Sheets access token. If the previous token expired,
 * Google may display an account/consent dialog and this must be called from a
 * user-driven action.
 */
export async function getAccessToken(): Promise<string> {
  if (hasUsableAccessToken()) {
    return state.accessToken!
  }

  if (!state.user) {
    throw new Error('Sign in with Google before accessing your spreadsheet.')
  }

  const google = await loadGoogleIdentityServices()
  const clientId = configuredClientId ?? getClientId()

  return requestAccessToken(google, clientId, state.user.email)
}

export function signOut(): void {
  state.user = null
  state.accessToken = null
  state.accessTokenExpiresAt = null
  state.error = null

  window.google?.accounts.id.disableAutoSelect()
}

async function handleIdentityCredential(response: GoogleCredentialResponse): Promise<void> {
  state.loading = true
  state.error = null

  try {
    state.user = decodeGoogleIdentity(response.credential)
  } catch (error) {
    state.error = errorMessage(error)
  } finally {
    state.loading = false
  }
}

function requestAccessToken(
  google: GoogleIdentityServices,
  clientId: string,
  email: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SHEETS_SCOPE,
      callback: (response) => {
        if (response.error || !response.access_token || !response.expires_in) {
          reject(new Error(response.error_description ?? response.error ?? 'Google authorization failed.'))
          return
        }

        state.accessToken = response.access_token
        state.accessTokenExpiresAt = Date.now() + response.expires_in * 1_000
        resolve(response.access_token)
      },
    })

    tokenClient.requestAccessToken({ hint: email, prompt: '' })
  })
}

function getClientId(): string {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    throw new Error('VITE_GOOGLE_CLIENT_ID is not configured.')
  }

  return clientId
}

function loadGoogleIdentityServices(): Promise<GoogleIdentityServices> {
  if (window.google) {
    return Promise.resolve(window.google)
  }

  if (!googleLibrary) {
    googleLibrary = new Promise<GoogleIdentityServices>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://accounts.google.com/gsi/client'
      script.async = true
      script.onload = () => {
        if (window.google) {
          resolve(window.google)
        } else {
          reject(new Error('Google Identity Services did not load.'))
        }
      }
      script.onerror = () => reject(new Error('Unable to load Google Identity Services.'))
      document.head.append(script)
    }).catch((error: unknown) => {
      googleLibrary = null
      throw error
    })
  }

  return googleLibrary ?? Promise.reject(new Error('Google Identity Services did not load.'))
}

function isGoogleIdentityClaims(value: unknown): value is {
  sub: string
  email: string
  name?: string
  picture?: string
} {
  if (!value || typeof value !== 'object') {
    return false
  }

  const claims = value as Record<string, unknown>
  return (
    typeof claims.sub === 'string' &&
    typeof claims.email === 'string' &&
    (claims.picture === undefined || typeof claims.picture === 'string')
  )
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Google authorization failed.'
}

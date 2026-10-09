import { reactive, readonly } from 'vue'

export const GOOGLE_DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'
export const GOOGLE_DRIVE_APPDATA_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

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

let googleLibrary: Promise<GoogleIdentityServices> | null = null
let configuredClientId: string | null = null

const IDENTITY_STORAGE_KEY = 'shelf-goblin-user'

function saveIdentity(identity: GoogleIdentity): void {
  try {
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity))
  } catch {
    // localStorage unavailable (private browsing, etc.) — silent fail
  }
}

function loadIdentity(): GoogleIdentity | null {
  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof (parsed as Record<string, unknown>).subject === 'string' &&
      typeof (parsed as Record<string, unknown>).email === 'string' &&
      typeof (parsed as Record<string, unknown>).name === 'string'
    ) {
      return parsed as GoogleIdentity
    }
    return null
  } catch {
    return null
  }
}

function clearIdentity(): void {
  try {
    localStorage.removeItem(IDENTITY_STORAGE_KEY)
  } catch {}
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

let initializationPromise: Promise<void> | null = null

export async function initializeGoogleAuth(): Promise<void> {
  if (initializationPromise) {
    return initializationPromise
  }

  initializationPromise = (async () => {
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

      state.initialized = true

      // Restore a previously saved identity so the route guard sees authState.user
      // synchronously on refresh, without waiting for One Tap's async callback.
      if (!state.user) {
        const saved = loadIdentity()
        if (saved) state.user = saved
      }

      // The button is the explicit fallback; One Tap is what enables an
      // automatic sign-in attempt on a later visit without a button click.
      google.accounts.id.prompt()
  })()
  
  return initializationPromise
}

/**
 * Renders Google's own sign-in button. Google Sheets consent is intentionally
 * deferred until a Sheets action calls getAccessToken from a user gesture.
 */
export async function renderGoogleSignInButton(element: HTMLElement): Promise<void> {
  const google = await loadGoogleIdentityServices()

  element.replaceChildren()
  google.accounts.id.renderButton(element, {
    theme: 'outline',
    size: 'large',
    text: 'signin_with',
    shape: 'rectangular',
  })
}

/**
 * Returns a non-expired access token covering Drive file and appdata scopes.
 * Google may display an account/consent dialog; call from a user gesture.
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

/**
 * Thrown when an OAuth token request requires a user gesture to open the consent
 * popup — typical on mobile where the automatic post-sign-in flow is too far from
 * the original tap to satisfy the browser's popup-blocker rules.
 */
export class DriveConsentRequiredError extends Error {
  constructor() {
    super('Tap "Connect bookshelf" to grant access to Google Drive.')
    this.name = 'DriveConsentRequiredError'
  }
}

/**
 * Requests a Drive/Sheets access token synchronously from a user gesture.
 * Unlike getAccessToken(), this skips the async library-load step and goes
 * directly to the token client so the popup-open lands inside the gesture handler.
 * Call this from a button-click handler after catching DriveConsentRequiredError.
 */
export async function requestDriveAccess(): Promise<void> {
  if (hasUsableAccessToken()) return

  if (!state.user) {
    throw new Error('Sign in with Google before accessing your bookshelf.')
  }

  const google = window.google
  if (!google) {
    throw new Error('Google Identity Services is not loaded.')
  }

  const clientId = configuredClientId ?? getClientId()
  await requestAccessToken(google, clientId, state.user.email)
}

export function signOut(): void {
  state.user = null
  state.accessToken = null
  state.accessTokenExpiresAt = null
  state.error = null

  clearIdentity()
  window.google?.accounts.id.disableAutoSelect()
}

async function handleIdentityCredential(response: GoogleCredentialResponse): Promise<void> {
  state.loading = true
  state.error = null

  try {
    const identity = decodeGoogleIdentity(response.credential)
    await verifyAccess(response.credential)
    state.user = identity
    saveIdentity(identity)
  } catch (error) {
    state.error = errorMessage(error)
  } finally {
    state.loading = false
  }
}

async function verifyAccess(idToken: string): Promise<void> {
  const response = await fetch('/.netlify/functions/verify-access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  })

  if (!response.ok) {
    const data = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(data.error ?? 'Access denied.')
  }
}

function requestAccessToken(
  google: GoogleIdentityServices,
  clientId: string,
  email: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 15-second guard for browsers that block the popup without calling the callback.
    const timeout = setTimeout(() => reject(new DriveConsentRequiredError()), 15_000)

    const tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: `${GOOGLE_DRIVE_FILE_SCOPE} ${GOOGLE_DRIVE_APPDATA_SCOPE}`,
      callback: (response) => {
        clearTimeout(timeout)

        if (response.error === 'popup_blocked_by_browser' || response.error === 'popup_closed_by_user') {
          reject(new DriveConsentRequiredError())
          return
        }

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

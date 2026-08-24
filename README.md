# Shelf Goblin

Book Tracker for your collection.

## Local configuration

Copy `.env.example` to `.env.local` and provide values for two environment variables:

- `VITE_GOOGLE_CLIENT_ID` — your Google OAuth 2.0 Web Client ID
- `VITE_GOOGLE_BOOKS_API_KEY` — your Google Books API key

Do not add a client secret: this is a browser-only application.

In Google Cloud Console, add the local Vite origin (normally `http://localhost:5173`) and each deployed application origin to that Web client’s **Authorized JavaScript origins**. The OAuth consent screen must include the `drive.file` and `drive.appdata` scopes requested by the application (not the broader Sheets or Drive scopes).

The public privacy policy is served at `/privacy.html`; configure the deployed URL (for example, `https://goblin.spicyeyes.com/privacy.html`) as the OAuth consent screen’s privacy policy link. The support form is at `/support.html`; its POST endpoint is intentionally not wired yet.

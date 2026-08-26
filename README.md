# Shelf Goblin

Book Tracker for your collection.

## Local development

### Prerequisites

- Node.js 22+
- Netlify CLI installed globally: `npm install -g netlify-cli`

### Environment setup

Copy `.env.example` to `.env.local` and fill in the values:

```
VITE_GOOGLE_CLIENT_ID=your_google_oauth_web_client_id_here
VITE_GOOGLE_BOOKS_API_KEY=your_api_key_here
ALLOWED_EMAILS=your_email@example.com,another@example.com
```

- `VITE_GOOGLE_CLIENT_ID` — OAuth 2.0 Web Client ID from Google Cloud Console
- `VITE_GOOGLE_BOOKS_API_KEY` — Google Books API key
- `ALLOWED_EMAILS` — comma-separated list of Google account emails permitted to access the app

Do not add a client secret: the browser-side auth is handled entirely by Google Identity Services.

### Google Cloud Console setup

1. Go to **APIs & Services → Credentials** and open your OAuth 2.0 Web Client
2. Under **Authorized JavaScript origins**, add:
   - `http://localhost:5253` (Netlify dev proxy — used for local development)
3. The OAuth consent screen must include the `drive.file` and `drive.appdata` scopes (not the broader Sheets or Drive scopes)

### Running locally

Use `netlify dev` instead of `npm run dev`. This starts both the Vite dev server (port 5252) and the Netlify functions server, proxied together at:

```
http://localhost:5253
```

The `/.netlify/functions/verify-access` allowlist function only works through this proxy — going directly to port 5252 will result in access being denied.

---

## Deploying to Netlify

### First-time setup

1. Push the repository to GitHub
2. In the Netlify dashboard, click **Add new site → Import an existing project** and connect the GitHub repo
3. Netlify will detect `netlify.toml` automatically — the build command (`npm run build`) and publish directory (`dist`) are already configured

### Environment variables

In the Netlify dashboard go to **Site configuration → Environment variables** and add:

| Variable | Value |
|---|---|
| `VITE_GOOGLE_CLIENT_ID` | Your Google OAuth Web Client ID |
| `VITE_GOOGLE_BOOKS_API_KEY` | Your Google Books API key |
| `ALLOWED_EMAILS` | Comma-separated list of permitted email addresses |

### Google Cloud Console — production origins

Back in **APIs & Services → Credentials**, add your production URL to **Authorized JavaScript origins**, e.g. `https://your-site.netlify.app`.

### Deploying changes

Every push to `main` triggers an automatic deploy. To manually trigger one, use the Netlify dashboard or:

```
netlify deploy --prod
```

### Updating the allowlist

Edit `ALLOWED_EMAILS` in the Netlify dashboard environment variables, then trigger a redeploy for the change to take effect.

---

## Notes

The privacy policy is served at `/privacy.html`; configure the deployed URL (e.g. `https://your-site.netlify.app/privacy.html`) as the OAuth consent screen’s privacy policy link. The support form is at `/support.html`; its POST endpoint is not yet wired up.

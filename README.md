# Basement at 6:17 - Murder Mystery Web App

React frontend (`client/`) + Node/Express backend (`server/`) for running a home murder mystery game.

## Local development

1. Install dependencies for both apps:

```bash
npm run install-all
```

2. Start backend:

```bash
node server/index.js
```

3. Start frontend in another terminal:

```bash
cd client
npm run dev
```

Optional (if backend is not local):

```bash
cd client
cp .env.example .env
```

Defaults:
- Backend URL: `http://localhost:4000`
- Host PIN: `9000`
- Player PINs: `1001` to `1022`

## Frontend deployment (GitHub Pages)

Workflow file: `.github/workflows/deploy-frontend-gh-pages.yml`

It now:
- Builds `client/`
- Publishes to `gh-pages`
- Uses `force_orphan` for clean branch publishing
- Uses write permissions for `GITHUB_TOKEN`

After first successful run:
1. Open repository `Settings -> Pages`
2. Set source to `Deploy from a branch`
3. Select `gh-pages` and `/ (root)`

The Vite build now uses a relative base path (`--base ./`) so asset links still work if the repo name changes.

## Vercel deployment (current)

This app is deployed on Vercel with:
- Frontend: Static site from `client/dist`
- Backend: Serverless function at `/api`

The app automatically deploys when you push to `main` branch.

### Twilio phone calls setup (optional)

To enable phone calls when meetings start:

1. Sign up for Twilio at https://www.twilio.com/
2. Get your credentials from the Twilio Console:
   - Account SID
   - Auth Token
   - A Twilio phone number
3. Add these environment variables in Vercel:
   - Go to your Vercel project → Settings → Environment Variables
   - Add:
     - `TWILIO_ACCOUNT_SID` = your Account SID
     - `TWILIO_AUTH_TOKEN` = your Auth Token
     - `TWILIO_PHONE_NUMBER` = your Twilio phone number (format: `+15551234567`)

4. Redeploy to apply the changes

Without these variables, the app still works but won't make phone calls (in-app alerts still work).

## Backend behavior (optimized for game night)

- Token-based login for host and players
- Host-only admin APIs (clues reveal, votes view, tally, reset)
- One active vote per voter (changing vote replaces prior vote)
- Detective vote weighting handled once per final vote
- Round reset endpoint for replaying quickly

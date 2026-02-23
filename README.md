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

## Backend deployment

Deploy `server/` to Render, Railway, Fly.io, or similar Node host.

Recommended env vars:
- `PORT` (provided by host)
- `CORS_ORIGINS` (comma-separated origins allowed to call API)
  - Example: `https://mohitunecha.github.io,http://localhost:5173`

For frontend production API URL, set GitHub repository variable:
- `VITE_API_BASE` = your deployed backend URL

The GitHub Actions build injects this value automatically.

## Backend behavior (optimized for game night)

- Token-based login for host and players
- Host-only admin APIs (clues reveal, votes view, tally, reset)
- One active vote per voter (changing vote replaces prior vote)
- Detective vote weighting handled once per final vote
- Round reset endpoint for replaying quickly

# Basement at 6:17 — Murder Mystery Web App

Local scaffold for the game: React frontend (Vite) and Node/Express backend.

Quick start

1. Install dependencies for both server and client:

```bash
npm run install-all
```

2. Start the server:

```bash
node server/index.js
```

3. Start the client (in a separate terminal):

```bash
cd client
npm run dev
```

Notes
- Server runs on port 4000 by default.
- Host PIN: `9000`. Player PINs: `1001`–`1022` (match players from your game pack).
- Host dashboard allows revealing clues and viewing votes. Players log in with their PIN to see their role card.

Next steps
- Finish client UX polish and printing templates.
- Add persistent storage for votes and revealed clues (optional).
- Add session tokens and secure auth (optional for production).
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

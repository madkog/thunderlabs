# Thunderlabs Web

<!-- TODO: one line on what the app is for -->

The web app for Thunderlabs, built with Next.js 16, React 19 and TypeScript. It runs against the Express API in `../api`.

## Getting started

<!-- TODO: confirm the Node version -->

Requires Node 24.

```sh
# from the repo root
npm install
npm run dev            # API on http://localhost:3001, app on http://localhost:3000
```

Next.js rewrites `/api/*` to `http://localhost:3001`, so the browser only talks to port 3000 and no CORS setup is needed.

## Scripts

Run these from `apps/web/`, or from the root with `-w web`.

| Command         | What it does               |
| --------------- | -------------------------- |
| `npm run dev`   | Dev server with hot reload |
| `npm run build` | Production build           |
| `npm run start` | Serve the production build |
| `npm run lint`  | Lint (ESLint)              |

## What it does

<!-- TODO: one bullet per feature, bold label first -->

- **Feature.** What it does for the user.

### Performance

<!-- TODO: what keeps it fast -->

-

### Testing

<!-- TODO: fill in once tests exist -->

| What                     | How |
| ------------------------ | --- |
| Unit and component tests |     |
| End-to-end tests         |     |
| Lint, format and types   |     |

## Project Breakdown

### Design decisions

<!-- TODO: numbered, bold title then the reason -->

1. **Next.js rewrites as the API proxy.** The browser only talks to the web app, so there is no CORS setup and the API URL lives in one place (`next.config.ts`).

### Principles

1. **Modular.** Each piece has one job, and components don't know about each other.
2. **Transportable.** <!-- TODO -->
3. **Simple to read.** <!-- TODO -->

### Structure

<!-- TODO: update as folders are added -->

```
src/
  app/          # App Router pages, layout and global styles
public/         # static assets
```

### Request flow

<!-- TODO: numbered steps from user action to API response -->

1.

Failures: <!-- TODO: how errors are shown and logged -->

### How it was built

<!-- TODO: layer by layer, each with its tests -->

1.

### Trade-offs and next steps

- The rewrite points at `http://localhost:3001`, so a deployment needs the API URL set per environment.
- No tests yet.
- No CI yet.

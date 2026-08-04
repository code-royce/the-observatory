# The Observatory — frontend

The React + Vite frontend for The Observatory, AKA "Light Pollution Analytics
and Celestial Visibility Planner". This is the app's actual UI — the Flask
backend in `app/` serves JSON only and no HTML.

Requirements: Node.js >= 24.0.0 (or latest LTS, whichever is newer) with npm.
This directory's `package.json` is the only dependency file for the frontend;
the backend's are in the repo root's `requirements.txt`. Full setup for both
halves is in the [root README](../README.md).

## Local development

1. `npm install` from *this* directory. Once per machine, and again after
   pulling new dependencies.
2. **Start the backend first**, in a separate terminal from the repo root
   (`python run.py`). `vite.config.ts` proxies `/api` to `127.0.0.1:5000`, so
   without it the UI loads but every request fails.
3. `npm run dev` — starts the dev server, usually on `http://localhost:5173`.
   Open that URL, not the Flask port.
4. `npm run build` — production build, into `dist/`. Worth running before you
   push, since it type-checks (`tsc -b`) and the dev server doesn't.
5. `npm run preview` — serves the built output. Its proxy inherits the same
   `server.proxy` config as `dev`, so it can still reach Flask.

`npm run lint` is not part of the build and currently reports pre-existing
`react-hooks/set-state-in-effect` errors.

## Deploying

`.github/workflows/deploy.yml` builds this directory and publishes `dist/` to
GitHub Pages on every push to `main`. It passes an explicit `--base` matching
the repository name; that value is repo-specific and is **currently still set
to the upstream class repo**, so a Pages deploy from this fork would 404 on
every asset. `npm run dev` serves from `/` and will not surface this.
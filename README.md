# The Observatory

Light Pollution Analytics and Celestial Visibility Planner — search the sky for
what's actually visible from where you are, given the local light pollution and
the time of night.

Originally built as the CS 411 (Database Systems, Summer 2026) final project by
Team 018, theSQLInjectors — see [TeamInfo.md](TeamInfo.md). This repository is a
personal fork kept as an archive and continued out of interest.

## What's here

| Path | What it is |
| --- | --- |
| `app/` | Flask backend. A headless JSON API — it serves no HTML. |
| `the-observatory/` | React + Vite frontend. This is the actual UI. |
| `sql/` | Stored procedures, triggers, and constraints. See [`sql/README.md`](sql/README.md). |
| `tests/` | Every test. See [`tests/README.md`](tests/README.md). |
| `doc/` | Reports and diagrams. See [`doc/README.md`](doc/README.md). |

## Before you start

**This project has two halves with two separate toolchains, and you need both
to run the app.** The frontend is not served by Flask — it's a separate Vite
dev server that proxies API calls to Flask.

| Half | Needs | Dependencies declared in |
| --- | --- | --- |
| Backend | Python 3 + pip | `requirements.txt` |
| Frontend | Node.js >= 24 + npm | `the-observatory/package.json` |

Between those two files, **everything the project needs is covered.** There is
no third install step, no global tooling, and no system packages to add. Run
each one once per machine and you're done.

You also need access to a MySQL database — see step 5 below.

## Setup (once per machine)

### 1. Backend

From the repo root:

1. Create a virtual environment.
    - macOS/Linux: `python3 -m venv .venv`
    - Windows: `py -3 -m venv .venv`
2. Activate it.
    - macOS/Linux: `. .venv/bin/activate`
    - Windows: `.venv\Scripts\activate`
3. Install every backend dependency: `pip install -r requirements.txt`
4. Copy `config.example.py` to `config.py`, then fill in your database
   username and password.
    - `config.py` is gitignored. **Never** commit credentials.
    - The host and database name in the example file point at this fork's
      Cloud SQL instance. If you're working against a different one, change
      those too.
5. Verify the database connection before going further:
   `python tests/test_connection.py`
    - Prints `True` and lists every table when `config.py` and the connection
      are working.
    - If it fails with `2003 (HY000) ... (10060)`, that's a **network** error,
      not a bad password — your IP almost certainly isn't in the Cloud SQL
      instance's Authorized Networks list. A wrong password reports
      `1045 Access denied` instead.

Steps 4 and 5 assume a database already exists. To build one from scratch on a
new Cloud SQL instance, see [`sql/README.md`](sql/README.md).

### 2. Frontend

From `the-observatory/`:

```
npm install
```

## Running the app

**Two terminals, both from the repo root, at the same time.** The frontend
needs the backend running — Vite proxies `/api` to Flask, so without it every
search fails.

Terminal 1 — backend:
```
.venv\Scripts\activate      # or: . .venv/bin/activate
python run.py
```
Listens on `http://127.0.0.1:5000`.

Terminal 2 — frontend:
```
cd the-observatory
npm run dev
```
Prints a local URL, usually `http://localhost:5173`. **Open that one**, not the
Flask port — Flask serves no HTML.

To hit the API directly without the frontend, use the Flask port:
`http://127.0.0.1:5000/api/search?q=orion`

## Testing

All tests live in `tests/`. Run them from the repo root, not from inside that
folder. See [`tests/README.md`](tests/README.md) for what each one covers and
what it needs.

```
python tests/test_connection.py           # config.py + Cloud SQL connectivity
python tests/test_horizon_calculator.py   # no database needed
python tests/test_add_constellation.py    # the AddConstellationToList procedure
python tests/test_nearby_reports.py       # advanced query 3
python tests/test_users_routes.py         # database mocked
.\tests\test_lists_routes.ps1             # needs the backend running
```

Each exits non-zero when a check fails. The two that touch existing data
create and delete their own rows, so they're safe to run as often as you like.

## Adding a new route

The backend is organized as Flask Blueprints under `app/routes/`, not one
long file, so multiple people can add routes without editing the same file.

1. Create (or extend) a file under `app/routes/`, defining a `Blueprint`.
2. Register it in `app/__init__.py` via:
    - `from app.routes.[FILE_NAME] import blueprint_name`
    - `app.register_blueprint(blueprint_name, url_prefix='/api')`
   A route is not reachable until it has both of these in `app/__init__.py`,
   even if the file defining it exists.
3. Use `get_db_connection()` and the `handle_db_errors` decorator from
   `app/utils.py` instead of writing your own DB connection or
   try/except boilerplate. See `app/routes/search.py` for an example of
   both, plus `with` blocks for automatic cursor/connection cleanup.

## Adding a dependency

- **Backend:** install it, then add the pinned line to `requirements.txt`.
  Prefer editing the file by hand over `pip freeze > requirements.txt` — a
  freeze on Windows also writes `colorama`, a platform-specific transitive
  dependency of `click` that pip installs on its own and that doesn't belong
  in a cross-platform requirements file.
- **Frontend:** `npm install <pkg>` from `the-observatory/` updates
  `package.json` and `package-lock.json`. Commit both.
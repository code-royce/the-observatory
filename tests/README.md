# Tests

Run everything from the **repo root** with the virtual environment active,
not from inside this folder. Each Python file puts the repo root on
`sys.path` itself, so both `python tests/test_x.py` and
`python -m tests.test_x` work.

Every test exits non-zero when a check fails, so they can be chained.

| File | Tests | Needs |
|---|---|---|
| `test_connection.py` | `config.py` and raw connectivity to Cloud SQL | DB |
| `test_horizon_calculator.py` | `app/horizon_calculator.py` — known-answer checks | nothing |
| `test_add_constellation.py` | the `AddConstellationToList` stored procedure | DB |
| `test_nearby_reports.py` | `GET /api/reports/nearby` (advanced query 3) | DB |
| `test_users_routes.py` | `POST /users`, with the database mocked | `config.py` |
| `test_lists_routes.ps1` | all seven `/api/lists` routes, over HTTP | running backend |

```
python tests/test_connection.py
python tests/test_horizon_calculator.py
python tests/test_add_constellation.py
python tests/test_nearby_reports.py
python tests/test_users_routes.py
.\tests\test_lists_routes.ps1
```

## Notes on individual tests

**`test_connection.py`** is the first thing to run when something breaks and
you don't know whether it's Flask or the database. Prints `True` and lists
every table.

**`test_add_constellation.py`** creates its own `ObservationList` and deletes
it in a `finally` block, so existing data is never touched. It requires the
procedure to already be installed on Cloud SQL — the files in `sql/` are not
applied automatically. A `1318 Incorrect number of arguments` failure means the
installed copy is older than `sql/stored_procedures/AddConstellationToList.sql`
and needs re-running. It passes magnitude 3 explicitly, which is what
`doc/Database Design.pdf` published its figures against, so its expected
values stay comparable to the doc.

**`test_nearby_reports.py`** is read-only. It computes its expected row count
with a separately written query rather than trusting the route's own SQL, and
checks the radius filter actually excludes distant reports.

**`test_users_routes.py`** mocks the database entirely, but still needs
`config.py` to exist — importing the route pulls in `app.utils`, which reads
it at import time. Worth knowing if this ever goes into CI, since `config.py`
is gitignored.

**`test_lists_routes.ps1`** needs no virtual environment, only a running
backend. It creates its own observation list, exercises every route against
it, then deletes it. That includes marking a saved object observed, which is
what the transaction's metadata query counts, so a failure there usually shows
up as a stuck progress panel on the list page.

- `-Pause` stops after each change and prints a URL and a SQL query, so you
  can watch the data change instead of taking the assertions on faith.
- `-UserId 42` runs as a different user; `-BaseUrl` points at a deployed
  backend.
- If Windows blocks it:
  `pwsh -ExecutionPolicy Bypass -File .\tests\test_lists_routes.ps1`

### Testing the users route in PowerShell
With the backend running locally, send a POST to `/users` from PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:5000/users" -Method POST -ContentType "application/json" -Body '{"name":"Davidson","email":"davidson2@example.com"}'
```

A successful response should look like:

```json
{"message":"User created successfully.","user_id":2057}
```

Then verify the insert in the same MySQL database configured by `config.py`:

```sql
SELECT UserID, Name, Email
FROM Users
WHERE Email = 'davidson2@example.com';
```

If the row appears, the new user was stored successfully.

# SQL

Clean copies of every piece of SQL the project uses, kept here to be read and
reviewed — plus, in `SETUP/`, the scripts that build a database from scratch.

Nothing here runs on its own. The Flask backend calls whatever is already
installed on the instance named in `config.py`.

## What's here

| Path | What it is |
| --- | --- |
| `schema.sql` | Every `CREATE TABLE`. Structure only, no rows. |
| `stored_procedures/` | 5 procedures. |
| `triggers/` | 3 triggers. |
| `constraints/` | CHECK and UNIQUE constraints, already included in `schema.sql`. |
| `transactions/` | Advanced queries, read from disk by `app/routes/lists.py`. |
| `migrations/` | One-off changes, already applied and reflected in `schema.sql`. |
| `SETUP/` | The install scripts. See below. |

## After editing a procedure or trigger

Changing a file here does nothing until you push it to the database:

```
python sql/SETUP/install_stored_programs.py
```

Installs all files from `stored_procedures/` and `triggers/`. Safe to re-run
as often as you like as each file drops its own object first. It finds the files
at runtime, so adding or removing one needs no change to the script.

This removes the need to paste these into the GCP console and fussing with the `DELIMITER` lines of code.

## Building a new database

**Only for standing up a fresh Cloud SQL instance.**
Nothing below is part of normal development, and step 2 destroys data.

1. Create the instance, then add your IP under **Connections → Networking**.
2. `python sql/SETUP/install_schema.py --yes`: recreates the database with EMPTY tables. Without `--yes` it prints what it would do and stops; it also refuses if `schema.sql` and `config.py` name different databases.
3. Upload `app_data.sql` to a Cloud Storage bucket, then GCP console → **Import** → point at that bucket `gs://` URI. These rows of data are reflective of when the project was submitted (8/2/2026).
4. `python sql/SETUP/install_stored_programs.py`: installs the procedures and triggers.

Steps 2 and 3 alone leave a database with no procedures and no triggers.

**Run step 4 last.** Not just for completeness — installing the triggers before
importing data breaks the import.

Same trap if you ever re-import into a database that already has triggers. The
fix is to redo step 2 first — dropping the tables drops their triggers with
them, so the sequence clears itself.

### Building somewhere else

Both scripts take `--database NAME` to target a database other than the one in
`config.py`. Useful for a scratch copy, or a second instance:

```
python sql/SETUP/install_schema.py --database <target db name> --yes
python sql/SETUP/install_stored_programs.py --database <target db name>
```

The flag applies per run; leave it off and both scripts behave exactly as
documented above.

### The data files

Both live on the latest [Release](../../../releases), not in the repo — they're
too big for git.

| File | Size | What |
| --- | --- | --- |
| `app_data.sql` | ~13 MB | The 6 tables the app uses. All a rebuild needs. |
| `raw_catalogs.sql` | ~45 MB | The original `hyg_v42`, `ga_n_2025`, `ngc_objects` imports. Provenance only — nothing reads them. |

Download `app_data.sql` into `sql/SETUP/` for step 3. Both filenames are
gitignored, so they won't be committed by accident.

## Notes

- `1318 Incorrect number of arguments` at runtime means the installed procedure
  is older than the file on disk. Re-run the installer.
- Deleting a `.sql` file doesn't drop its object from the database. The
  installer only creates and replaces.
- `2003 ... (10060)` from either script is a network timeout, not a bad
  password — your IP is missing from Authorized Networks.
- The `hyg_v42` → `CelestialObject` derivation was never committed.
  `CelestialObject` survives only as the 132,852 rows in `app_data.sql`.
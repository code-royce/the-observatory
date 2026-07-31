# Team018-theSQLInjectors
Contains files related to Light Pollution Analytics and Celestial Visibility Planner,
our final project for CS-411 Summer 2026, Database systems class.

## Local Development
The backend of this project is a Flask app. Python3 (and pip) are required
before following the directions below.

1. Navigate to the project directory.
2. Create a virtual environment.
    - macOS/Linux: `python3 -m venv .venv`
    - Windows: `py -3 -m venv .venv`
3. Activate the environment.
    - macOS/Linux: `. .venv/bin/activate`
    - Windows: `.venv\Scripts\activate`
4. Install the project's dependencies: `pip install -r requirements.txt`
5. Make a copy of `config.example.py` and rename it `config.py`.
    - Add your user name and password for the database.
    - **Never** commit a file to a repository with your login credentials.
6. (Optional) Verify your database connection independently of Flask: `python test_connection.py`.
    - Prints `True` and lists every table if `config.py` and the connection to GCP are working.
    - Useful first check if something's broken and you're not sure whether it's Flask or the database.
7. Start the app: `python run.py`

If you add a new package to the project, don't forget to add it to requirements.txt: `pip freeze > requirements.txt`

## Testing the Observation List routes
`test_lists_routes.ps1` exercises all seven `/api/lists` routes end to end. It creates its own observation list, runs every route against it, then deletes it again -- existing data is never touched, so it's safe to run as often as you like.

With the backend running, from the repo root: `.\test_lists_routes.ps1`. No virtual environment needed, since it only makes HTTP requests.
- Add `-Pause` to stop after each change and print both a URL and a SQL
  query, so you can watch the data change instead of taking the assertions on faith. Useful for the demo, or if you'd rather verify it yourself.
- Add `-UserId 42` to run as a different user, or `-BaseUrl` to point
  at a deployed backend.
- If Windows blocks the script, `pwsh -ExecutionPolicy Bypass -File
  .\test_lists_routes.ps1` runs it without changing any settings.

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

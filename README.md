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
7. Start the app: `flask run`

If you add a new package to the project, don't forget to add it to requirements.txt: `pip freeze > requirements.txt`

"""
install_stored_programs.py

Installs every stored procedure and trigger under sql/ into the database
config.py points at, replacing the manual copy-paste into the GCP console.

Files are discovered at runtime, so adding or removing one needs no change
here. Every file drops its own object first, which makes re-running safe and is
the normal way to push an edited procedure. Note that deleting a .sql file does
not remove the object from the database -- this only creates and replaces.

Run from the repo root with the virtual environment active:
    python sql/SETUP/install_stored_programs.py
"""

import sys
from pathlib import Path

# The repo root, so `app` and `config` resolve when this runs from sql/SETUP/.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import mysql.connector
from mysql.connector import Error

import config
from app.utils import get_db_connection

SQL_DIR = Path(__file__).resolve().parents[1]
SUBDIRS = ("stored_procedures", "triggers")


def database_arg(argv):
    """
    The value of a --database override, if one was given.

    Args:
        argv (list): Command-line arguments, without the script name.

    Returns:
        str: The database name, or None to use the one config.py names.
    """
    if "--database" in argv:
        i = argv.index("--database")
        if i + 1 < len(argv):
            return argv[i + 1]
    return None


def connect(database=None):
    """
    Connect to `database`, or to the one config.py names.

    Args:
        database (str): Overrides config.DB_NAME for this run only, so a
            scratch copy can be built without editing config.py.

    Returns:
        mysql.connector.connection.MySQLConnection: An open connection.
    """
    if database is None:
        return get_db_connection()
    return mysql.connector.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        database=database,
        port=config.DB_PORT,
    )


def is_only_comments(text):
    """
    Whether a block of SQL holds nothing the server would execute.

    Args:
        text (str): A candidate statement.

    Returns:
        bool: True if every line is blank or a -- comment.
    """
    for line in text.splitlines():
        stripped = line.strip()
        if stripped and not stripped.startswith("--"):
            return False
    return True


def split_statements(sql):
    """
    Split one .sql file into statements, using DELIMITER only to decide where
    each one ends. The directive itself is dropped rather than sent.

    Args:
        sql (str): The full text of a .sql file.

    Returns:
        list[str]: The statements in file order, delimiters removed, with
            comment-only fragments discarded.
    """
    delimiter = ";"
    statements = []
    buffer = []

    for line in sql.splitlines():
        stripped = line.strip()

        if stripped.upper().startswith("DELIMITER "):
            delimiter = stripped.split(None, 1)[1].strip()
            continue

        buffer.append(line)
        joined = "\n".join(buffer).rstrip()

        if joined.endswith(delimiter):
            statement = joined[: -len(delimiter)]
            if not is_only_comments(statement):
                statements.append(statement.strip())
            buffer = []

    trailing = "\n".join(buffer)
    if not is_only_comments(trailing):
        statements.append(trailing.strip())

    return statements


def main(argv=()):
    files = []
    for subdir in SUBDIRS:
        files.extend(sorted((SQL_DIR / subdir).glob("*.sql")))

    if not files:
        print("No .sql files found under " + ", ".join(SUBDIRS))
        return 1

    database = database_arg(list(argv))
    print(f"Installing {len(files)} files into {database or config.DB_NAME}\n")
    failures = []

    try:
        conn = connect(database)
    except Error as e:
        print(f"  Could not reach {config.DB_HOST}: {e}")
        print("\n2003/10060 is a network timeout, not a bad password -- usually")
        print("your IP is missing from the instance's Authorized Networks.")
        return 1

    with conn:
        with conn.cursor() as cursor:
            for path in files:
                label = f"{path.parent.name}/{path.name}"
                try:
                    for statement in split_statements(path.read_text(encoding="utf-8")):
                        cursor.execute(statement)
                    print(f"  ok    {label}")
                except Error as e:
                    failures.append(label)
                    print(f"  FAIL  {label}\n          {e}")

    print()
    if failures:
        print(f"{len(failures)} of {len(files)} failed: " + ", ".join(failures))
        return 1

    print(f"All {len(files)} installed.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))

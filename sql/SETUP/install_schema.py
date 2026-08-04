"""
install_schema.py

Creates the database and its tables from schema.sql. First step in rebuilding
from nothing -- data is loaded separately, and procedures and triggers come
last via install_stored_programs.py. See sql/README.md for the full sequence.

DESTRUCTIVE: schema.sql drops every table before creating it, so this requires
`--yes` appended rather than running on request.

Run from the repo root with the virtual environment active:
    python sql/SETUP/install_schema.py --yes
"""

import re
import sys
from pathlib import Path

# The repo root, so `config` resolves when this runs from sql/SETUP/.
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

import mysql.connector
from mysql.connector import Error

import config
from install_stored_programs import database_arg, split_statements

SCHEMA = Path(__file__).resolve().parents[1] / "schema.sql"


def target_database(sql):
    """
    The database schema.sql will actually write to.

    The name is baked into the file's USE statement, so it governs regardless
    of what config.py says.

    Args:
        sql (str): The full text of schema.sql.

    Returns:
        str: The database name, or None if there is no USE statement.
    """
    match = re.search(r"^USE\s+`([^`]+)`\s*;", sql, re.MULTILINE)
    return match.group(1) if match else None


def retarget(sql, name):
    """
    Point the CREATE DATABASE and USE lines at a different database.

    Rewrites the text in memory only -- schema.sql on disk is untouched. Every
    table name in the file is unqualified, so redirecting USE redirects all of
    it.

    Args:
        sql (str): The full text of schema.sql.
        name (str): The database to build instead.

    Returns:
        str: The rewritten SQL.
    """
    sql = re.sub(r"(CREATE DATABASE .*?`)[^`]+(`)",
                 rf"\g<1>{name}\g<2>", sql, count=1)
    return re.sub(r"(^USE\s+`)[^`]+(`\s*;)",
                  rf"\g<1>{name}\g<2>", sql, count=1, flags=re.MULTILINE)


def connect_to_server():
    """
    Connect to the server rather than to a database.

    app.utils.get_db_connection() always selects config.DB_NAME, which fails
    when that database does not exist yet.

    Returns:
        mysql.connector.connection.MySQLConnection: An open connection with no
            database selected.
    """
    return mysql.connector.connect(
        host=config.DB_HOST,
        user=config.DB_USER,
        password=config.DB_PASSWORD,
        port=config.DB_PORT,
    )


def main(argv):
    sql = SCHEMA.read_text(encoding="utf-8")
    target = target_database(sql)

    if target is None:
        print(f"No USE statement found in {SCHEMA.name}; cannot tell which "
              f"database it would write to.")
        return 1

    override = database_arg(list(argv))

    if override is not None:
        if not re.fullmatch(r"[A-Za-z0-9_]+", override):
            print(f"'{override}' is not a valid database name.")
            return 1
        sql = retarget(sql, override)
        target = override
    elif target != config.DB_NAME:
        print(f"{SCHEMA.name} writes to '{target}' but config.py names "
              f"'{config.DB_NAME}'.")
        print("Refusing to run rather than quietly building the wrong one.")
        print("Pass --database NAME if you meant to build somewhere else.")
        return 1

    if "--yes" not in argv:
        print(f"This drops and recreates every table in '{target}' on "
              f"{config.DB_HOST}, discarding all rows.")
        print("Nothing has been changed. Re-run with --yes to go ahead.")
        return 1

    statements = split_statements(sql)
    print(f"Applying {SCHEMA.name} to '{target}' on {config.DB_HOST}\n")

    try:
        with connect_to_server() as conn:
            with conn.cursor() as cursor:
                for statement in statements:
                    cursor.execute(statement)

                cursor.execute(
                    "SELECT COUNT(*) FROM INFORMATION_SCHEMA.TABLES "
                    "WHERE TABLE_SCHEMA = %s",
                    (target,),
                )
                tables = cursor.fetchone()[0]
    except Error as e:
        print(f"  FAIL  {e}")
        return 1

    print(f"  ok    {len(statements)} statements, {tables} tables now present")
    print("\nNext: load the data, then "
          "python sql/SETUP/install_stored_programs.py")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
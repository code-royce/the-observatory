"""
Smoke test for config.py and connectivity to the GCP Cloud SQL database,
independent of Flask.

Usage:
    python test_connection.py

Prints True if the connection succeeds, then lists every table in the
database. Run this first when debugging whether an issue is Flask or the
database connection itself.
"""
import config
import mysql.connector

conn = mysql.connector.connect(
    host=config.DB_HOST,
    user=config.DB_USER,
    password=config.DB_PASSWORD,
    database=config.DB_NAME,
    port=config.DB_PORT,
)
print(conn.is_connected())  # should print True

cursor = conn.cursor()
cursor.execute("SHOW TABLES;")
for row in cursor:
    print(row)

cursor.close()
conn.close()

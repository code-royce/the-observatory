
from flask import Flask, render_template, request
import mysql.connector
from mysql.connector import Error
import config

app = Flask(__name__)

# def get_db_connection():
#     """Return a new MySQL connection using values from config.py."""
#     return mysql.connector.connect(
#         host=config.DB_HOST,
#         user=config.DB_USER,
#         password=config.DB_PASSWORD,
#         database=config.DB_NAME,
#         port=config.DB_PORT,
#     )

@app.route("/")
def hello_world():
    return "<h1>Hello world</h1>"

# @app.teardown_appcontext
# def close_db(exception=None):
#     """Closes the database connection at the end of the request."""
#     db = g.pop('db', None)
#     if db is not None and db.is_connected():
#         db.close()

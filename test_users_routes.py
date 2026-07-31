import unittest
from unittest.mock import patch
from mysql.connector import IntegrityError, errorcode

from flask import Flask

from app import create_app
from app.routes.users import users_bp


class FakeCursor:
    def __init__(self):
        self.executed = None
        self.lastrowid = 42

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def execute(self, query, params):
        self.executed = (query, params)

    def fetchone(self):
        return (42,)


class FakeConnection:
    def __init__(self):
        self.cursor_obj = FakeCursor()
        self.committed = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False

    def cursor(self):
        return self.cursor_obj

    def commit(self):
        self.committed = True


class CreateUserRouteTests(unittest.TestCase):
    def setUp(self):
        app = Flask(__name__)
        app.testing = True
        app.register_blueprint(users_bp, url_prefix="")
        self.client = app.test_client()

    def test_accepts_valid_lowercase_payload(self):
        fake_conn = FakeConnection()

        with patch("app.routes.users.get_db_connection", return_value=fake_conn):
            response = self.client.post(
                "/users",
                json={"name": "Davidson", "email": "davidson@example.com"},
            )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["message"], "User created successfully.")
        self.assertEqual(response.get_json()["user_id"], 42)
        self.assertTrue(fake_conn.committed)
        self.assertEqual(fake_conn.cursor_obj.executed[1], ("Davidson", "davidson@example.com"))

    def test_rejects_missing_fields(self):
        response = self.client.post("/users", json={"name": "Davidson"})

        self.assertEqual(response.status_code, 400)
        self.assertIn("only 'name' and 'email'", response.get_json()["error"].lower())

    def test_rejects_extra_fields(self):
        response = self.client.post(
            "/users",
            json={"name": "Davidson", "email": "davidson@example.com", "extra": "x"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("only 'name' and 'email'", response.get_json()["error"].lower())

    def test_rejects_uppercase_field_names(self):
        response = self.client.post(
            "/users",
            json={"Name": "Davidson", "Email": "davidson@example.com"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("only 'name' and 'email'", response.get_json()["error"].lower())

    def test_rejects_duplicate_email(self):
        fake_conn = FakeConnection()
        fake_conn.cursor_obj.lastrowid = 42

        with patch("app.routes.users.get_db_connection", return_value=fake_conn):
            # Simulate duplicate key error from MySQL
            def fail_execute(query, params):
                raise IntegrityError(errorcode.ER_DUP_ENTRY, "Duplicate entry")

            fake_conn.cursor_obj.execute = fail_execute
            response = self.client.post(
                "/users",
                json={"name": "Davidson", "email": "davidson@example.com"},
            )

        self.assertEqual(response.status_code, 409)
        self.assertIn("email already exists", response.get_json()["error"].lower())

    def test_rejects_non_object_payloads(self):
        response = self.client.post("/users", data='"davidson@example.com"', content_type="application/json")

        self.assertEqual(response.status_code, 400)
        self.assertIn("object containing only", response.get_json()["error"].lower())


if __name__ == "__main__":
    unittest.main()

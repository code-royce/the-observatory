# SQL Database Features

This folder contains the source code for all stored procedures, triggers, and constraints used by the project.

These SQL files are **not executed automatically** by the application.

The Flask backend calls the procedures that are already installed in the shared Google Cloud SQL database.

If you modify any SQL file in this folder, you must execute it on the Cloud SQL database before the application will use the updated version.

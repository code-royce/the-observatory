/*
SaveObjectToList.sql

Purpose:
 Saves a celestial object to one of the user's observation lists.

Not called by any route -- POST /api/lists/<id>/objects inserts several
objects in one statement instead. Updated for the IsObserved/Notes columns so
the file still matches the schema, but the copy installed on Cloud SQL is
stale until someone re-runs it.
*/

DROP PROCEDURE IF EXISTS SaveObjectToList;

DELIMITER $$

CREATE PROCEDURE SaveObjectToList(
    IN p_ListID INT,
    IN p_ObjectID INT,
    IN p_Notes VARCHAR(250)
)
BEGIN
    INSERT INTO SavedObject (
        ListID,
        ObjectID,
        Notes
    )
    VALUES (
        p_ListID,
        p_ObjectID,
        p_Notes
    );

    SELECT
        p_ListID AS ListID,
        p_ObjectID AS ObjectID,
        'Object saved successfully.' AS Message;
END$$

DELIMITER ;

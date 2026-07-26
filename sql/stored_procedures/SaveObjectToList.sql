/*
SaveObjectToList.sql

Purpose:
 Saves a celestial object to one of the user's observation lists.
*/

DROP PROCEDURE IF EXISTS SaveObjectToList;

DELIMITER $$

CREATE PROCEDURE SaveObjectToList(
    IN p_ListID INT,
    IN p_ObjectID INT,
    IN p_ObservedStatus VARCHAR(250)
)
BEGIN
    INSERT INTO SavedObject (
        ListID,
        ObjectID,
        ObservedStatus
    )
    VALUES (
        p_ListID,
        p_ObjectID,
        p_ObservedStatus
    );

    SELECT
        p_ListID AS ListID,
        p_ObjectID AS ObjectID,
        'Object saved successfully.' AS Message;
END$$

DELIMITER ;

/*
CreateDefaultObservationList.sql

Purpose:
  Automatically creates a default observation list after a new user is added.
*/

DROP TRIGGER IF EXISTS CreateDefaultObservationList;

DELIMITER $$

CREATE TRIGGER CreateDefaultObservationList
AFTER INSERT ON Users
FOR EACH ROW
BEGIN
    INSERT INTO ObservationList (
        UserID,
        Latitude,
        Longitude,
        ListName
    )
    VALUES (
        NEW.UserID,
        NULL,
        NULL,
        'My First Observation List'
    );
END$$

DELIMITER ;

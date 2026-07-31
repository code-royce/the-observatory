/*
CreateDefaultObservationList.sql

Purpose:
  Automatically creates a default observation list after a new user
  is added. The list name depends on whether the user provided a name.
*/

DROP TRIGGER IF EXISTS CreateDefaultObservationList;

DELIMITER $$

CREATE TRIGGER CreateDefaultObservationList
AFTER INSERT ON Users
FOR EACH ROW
BEGIN
    IF NEW.Name IS NULL OR TRIM(NEW.Name) = '' THEN

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

    ELSE

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
            CONCAT(TRIM(NEW.Name), '''s Observation List')
        );

    END IF;
END$$

DELIMITER ;

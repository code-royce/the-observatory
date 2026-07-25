/*
TrimObservationListName.sql

Purpose:
 Removes leading and trailing whitespace from ListName before a new
 ObservationList row is inserted.
*/

DROP TRIGGER IF EXISTS TrimObservationListName;

DELIMITER $$

CREATE TRIGGER TrimObservationListName
BEFORE INSERT ON ObservationList
FOR EACH ROW
BEGIN
    SET NEW.ListName = TRIM(NEW.ListName);
END$$

DELIMITER ;

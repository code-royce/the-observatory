/*
CreateObservationList.sql

Purpose:
 Creates a new observation list for a user and returns the generated ListID.
*/

DROP PROCEDURE IF EXISTS CreateObservationList;

DELIMITER $$

CREATE PROCEDURE CreateObservationList(
    IN p_UserID INT,
    IN p_Latitude FLOAT,
    IN p_Longitude FLOAT,
    IN p_ListName VARCHAR(250)
)
BEGIN
    INSERT INTO ObservationList (
        UserID,
        Latitude,
        Longitude,
        ListName
    )
    VALUES (
        p_UserID,
        p_Latitude,
        p_Longitude,
        p_ListName
    );

    SELECT LAST_INSERT_ID() AS ListID;
END$$

DELIMITER ;

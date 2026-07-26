/*
CreateCommunityReport.sql

Purpose:
 Creates a new community report and returns the generated ReportID.
*/

DROP PROCEDURE IF EXISTS CreateCommunityReport;

DELIMITER $$

CREATE PROCEDURE CreateCommunityReport(
    IN p_UserID INT,
    IN p_Latitude FLOAT,
    IN p_Longitude FLOAT,
    IN p_ReportText TEXT
)
BEGIN
    INSERT INTO CommunityReport (
        UserID,
        Latitude,
        Longitude,
        ReportText
    )
    VALUES (
        p_UserID,
        p_Latitude,
        p_Longitude,
        p_ReportText
    );

    SELECT LAST_INSERT_ID() AS ReportID;
END$$

DELIMITER ;

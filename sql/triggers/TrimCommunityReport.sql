/*
TrimCommunityReport.sql

Purpose:
 Removes leading and trailing whitespace from ReportText before a new
 CommunityReport row is inserted.
*/

DROP TRIGGER IF EXISTS TrimCommunityReport;

DELIMITER $$

CREATE TRIGGER TrimCommunityReport
BEFORE INSERT ON CommunityReport
FOR EACH ROW
BEGIN
    SET NEW.ReportText = TRIM(NEW.ReportText);
END$$

DELIMITER ;

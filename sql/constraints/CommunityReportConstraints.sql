/*
CommunityReportConstraints.sql

Purpose:
 Prevents empty community reports and invalid latitude/longitude values.
*/

ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_not_empty
CHECK (
    ReportText IS NOT NULL
    AND CHAR_LENGTH(TRIM(ReportText)) > 0
);

ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_latitude
CHECK (
    Latitude IS NULL
    OR Latitude BETWEEN -90 AND 90
);

ALTER TABLE CommunityReport
ADD CONSTRAINT chk_community_report_longitude
CHECK (
    Longitude IS NULL
    OR Longitude BETWEEN -180 AND 180
);

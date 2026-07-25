/*
ObservationListCoordinateConstraints.sql

Purpose:
 Prevents invalid latitude and longitude values in ObservationList.
*/

ALTER TABLE ObservationList
ADD CONSTRAINT chk_observation_list_latitude
CHECK (
    Latitude IS NULL
    OR Latitude BETWEEN -90 AND 90
);

ALTER TABLE ObservationList
ADD CONSTRAINT chk_observation_list_longitude
CHECK (
    Longitude IS NULL
    OR Longitude BETWEEN -180 AND 180
);

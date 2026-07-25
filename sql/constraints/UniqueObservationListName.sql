/*
UniqueObservationListName.sql

Purpose:
  Prevents the same user from creating multiple observation lists with the
  same name.
*/

ALTER TABLE ObservationList
ADD CONSTRAINT uq_observation_list_user_name
UNIQUE (
    UserID,
    ListName
);

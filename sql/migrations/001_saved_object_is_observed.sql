/*
001_saved_object_is_observed.sql

Purpose:
  Replaces SavedObject.ObservedStatus, a VARCHAR(250) that had to hold either
  'seen'/'not seen' or a freeform note, with two columns that can both be set
  at once.

Why:
  ListMetadataByCategory.sql counts SUM(ObservedStatus = 'seen'), so writing a
  note into that column silently un-observed the row. One column could not
  carry both facts.

Applied to Cloud SQL on 2026-08-01. Verified afterwards: 134,283 rows,
7,558 observed, 2 notes preserved.

Anything reading SavedObject has to change with it -- see
sql/transactions/ListMetadataByCategory.sql and
sql/stored_procedures/AddConstellationToList.sql, both of which named the old
column. Note that MySQL coerces a string to 0 when comparing against a
TINYINT, so the old SUM(ObservedStatus = 'seen') would have kept running
against the new column and quietly counted the opposite rows.
*/

ALTER TABLE SavedObject
    ADD COLUMN IsObserved BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN Notes VARCHAR(250) NULL;

UPDATE SavedObject
SET IsObserved = TRUE
WHERE ObservedStatus = 'seen';

-- Anything that was neither sentinel was a note the user typed.
UPDATE SavedObject
SET Notes = ObservedStatus
WHERE ObservedStatus NOT IN ('seen', 'not seen');

ALTER TABLE SavedObject
    DROP COLUMN ObservedStatus;

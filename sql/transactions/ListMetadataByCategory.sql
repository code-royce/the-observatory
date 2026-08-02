/*
ListMetadataByCategory.sql

Purpose:
  Summarizes one ObservationList's progress, grouped by the category of the
  celestial objects saved to it. HAVING drops categories the user has
  finished, so the result answers "what is left to observe."

Advanced query: joins three tables and aggregates with GROUP BY.

Runs as the first of two queries inside the read transaction in
app/routes/lists.py -> list_detail(), at REPEATABLE READ. See
ListVisibilityByCategory.sql for the second.

This is Query 2 ("observation list metadata") from doc/Database Design.pdf,
unchanged except that the hardcoded ListID is now a bound parameter and that
SavedObject.ObservedStatus was replaced by a real boolean, IsObserved, so
SUM(ObservedStatus = 'Seen') is now SUM(IsObserved). Same counts, and the
comparison can no longer be defeated by a note being stored in the same
column.

Parameters:
  list_id -- ObservationList.ListID to summarize
*/

SELECT ObjectCategory,
       COUNT(ObjectID) AS TotalSaved,
       SUM(IsObserved) AS Observed,
       ROUND(SUM(IsObserved) / COUNT(ObjectID) * 100, 0)
           AS CompletionRate
FROM ObservationList
    NATURAL JOIN SavedObject
    NATURAL JOIN CelestialObject
WHERE ListID = %(list_id)s
GROUP BY ObjectCategory
HAVING CompletionRate < 100
ORDER BY CompletionRate DESC;

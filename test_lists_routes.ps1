<#
.SYNOPSIS
    End-to-end check of the seven ObservationList routes in
    app/routes/lists.py.

.DESCRIPTION
    Creates its own observation list, exercises every route against it, and
    deletes it again -- so it never touches anyone's real data and can be run
    as often as you like. The list is named with a timestamp so repeated runs
    don't collide with the uq_observation_list_user_name constraint.

    Requires the Flask backend to be running (python run.py) and a working
    config.py. Nothing else -- no venv needed, since this only makes HTTP
    requests.

.PARAMETER BaseUrl
    Where the backend is listening. Defaults to local dev.

.PARAMETER UserId
    An existing Users.UserID to own the test list.

.PARAMETER ObjectIds
    Three existing CelestialObject.ObjectIDs to save to the list. The
    defaults are real HYG catalog stars (1 Gem, 1 Pup, 10 Tau).

.PARAMETER Pause
    Stop after each change and print a URL and a SQL query you can use to
    see it for yourself before continuing. Use this when demonstrating to
    someone who'd rather watch the data change than trust the assertions.

.EXAMPLE
    .\test_lists_routes.ps1

.EXAMPLE
    .\test_lists_routes.ps1 -Pause

.EXAMPLE
    .\test_lists_routes.ps1 -BaseUrl http://127.0.0.1:5000 -UserId 42
#>

param(
    [string]$BaseUrl = 'http://127.0.0.1:5000',
    [int]$UserId = 1,
    [int[]]$ObjectIds = @(28664, 37541, 16811),
    [switch]$Pause
)

$script:passed = 0
$script:failed = 0

function Invoke-Api {
    <#
        Sends one request and returns its status code and parsed body.
        -SkipHttpErrorCheck stops PowerShell from treating a 400 or 404 as a
        crash, so the script can assert on error responses like any other.
    #>
    param(
        [string]$Method,
        [string]$Path,
        $Body
    )

    $params = @{
        Uri                = "$BaseUrl$Path"
        Method             = $Method
        SkipHttpErrorCheck = $true
    }
    if ($null -ne $Body) {
        $params.Body = ($Body | ConvertTo-Json -Compress)
        $params.ContentType = 'application/json'
    }

    $response = Invoke-WebRequest @params

    $parsed = $null
    if ($response.Content) {
        $parsed = $response.Content | ConvertFrom-Json
    }

    return [pscustomobject]@{
        Status = [int]$response.StatusCode
        Body   = $parsed
    }
}

function Report {
    param(
        [string]$Name,
        [bool]$Ok,
        [string]$Detail
    )

    if ($Ok) {
        Write-Host "  PASS  $Name" -ForegroundColor Green
        $script:passed++
        return
    }

    Write-Host "  FAIL  $Name" -ForegroundColor Red
    if ($Detail) {
        Write-Host "        $Detail" -ForegroundColor DarkGray
    }
    $script:failed++
}

function Wait-ForCheck {
    <#
        Under -Pause, stops and offers two ways to see what just happened:
        the API response in a browser, and the underlying rows in the mysql
        client. Does nothing at all otherwise, so the default run stays
        non-interactive and safe for automation.
    #>
    param(
        [string]$What,
        [string]$Url,
        [string]$Sql
    )

    if (-not $Pause) {
        return
    }

    Write-Host ""
    Write-Host "  PAUSED -- $What" -ForegroundColor Yellow
    if ($Url) {
        Write-Host "    browser:  $Url" -ForegroundColor Cyan
    }
    if ($Sql) {
        Write-Host "    mysql:    $Sql" -ForegroundColor Cyan
    }
    $null = Read-Host "    press Enter to continue"
}

Write-Host ""
Write-Host "ObservationList route smoke test" -ForegroundColor Cyan
Write-Host "Target: $BaseUrl   User: $UserId"
Write-Host ""

# Preflight. A refused connection throws rather than returning a status, so
# it needs its own check -- otherwise every assertion below fails with the
# same unhelpful error.
try {
    $null = Invoke-WebRequest -Uri "$BaseUrl/api/users/$UserId/lists" `
        -SkipHttpErrorCheck -ErrorAction Stop
}
catch {
    Write-Host "Cannot reach $BaseUrl" -ForegroundColor Red
    Write-Host "Is the backend running? From the repo root:" -ForegroundColor DarkGray
    Write-Host "    .venv\Scripts\activate" -ForegroundColor DarkGray
    Write-Host "    python run.py" -ForegroundColor DarkGray
    exit 1
}

$listName = "Smoke Test $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$listId = $null

try {
    # --- Create -----------------------------------------------------------
    # Coordinates matter: the detail route only runs its visibility query for
    # a list that has them, so an unlocated list would skip half the
    # transaction. These are Champaign, IL.
    $r = Invoke-Api POST '/api/lists' @{
        user_id   = $UserId
        list_name = $listName
        latitude  = 40.1164
        longitude = -88.2434
    }
    Report 'POST /api/lists creates a list' ($r.Status -eq 201) "got $($r.Status)"
    $listId = $r.Body.data.ListID

    if (-not $listId) {
        Write-Host ""
        Write-Host "Could not create a test list; stopping." -ForegroundColor Red
        exit 1
    }
    Write-Host "        (created ListID $listId)" -ForegroundColor DarkGray

    Wait-ForCheck "list $listId was just created, with 0 objects on it" `
        "$BaseUrl/api/users/$UserId/lists" `
        "SELECT ListID, ListName, Latitude FROM ObservationList WHERE UserID = $UserId ORDER BY CreatedAt DESC LIMIT 3;"

    $r = Invoke-Api POST '/api/lists' @{
        user_id = $UserId; list_name = $listName
    }
    Report 'duplicate list name is rejected (409)' ($r.Status -eq 409) "got $($r.Status)"

    $r = Invoke-Api POST '/api/lists' @{ user_id = 0; list_name = 'Orphan' }
    Report 'unknown user_id is rejected (400)' ($r.Status -eq 400) "got $($r.Status)"

    $r = Invoke-Api POST '/api/lists' @{ user_id = $UserId }
    Report 'missing list_name is rejected (400)' ($r.Status -eq 400) "got $($r.Status)"

    # --- Read -------------------------------------------------------------
    $r = Invoke-Api GET "/api/users/$UserId/lists"
    $found = $r.Body.data | Where-Object { $_.ListID -eq $listId }
    Report "GET /api/users/$UserId/lists includes the new list" `
        (($r.Status -eq 200) -and $null -ne $found) "got $($r.Status)"

    # --- Add objects ------------------------------------------------------
    $r = Invoke-Api POST "/api/lists/$listId/objects" @{ object_ids = $ObjectIds }
    $added = $r.Body.data.added
    Report "adds $($ObjectIds.Count) objects" `
        (($r.Status -eq 201) -and ($added -eq $ObjectIds.Count)) `
        "status $($r.Status), added $added"

    # Re-adding is ordinary user behavior, so it must succeed while inserting
    # nothing -- that's the ON DUPLICATE KEY UPDATE clause doing its job.
    $r = Invoke-Api POST "/api/lists/$listId/objects" @{ object_ids = $ObjectIds }
    Report 're-adding the same objects skips them all' `
        (($r.Status -eq 201) -and ($r.Body.data.added -eq 0) -and
         ($r.Body.data.skipped -eq $ObjectIds.Count)) `
        "added $($r.Body.data.added), skipped $($r.Body.data.skipped)"

    # --- Detail (the transaction) -----------------------------------------
    $r = Invoke-Api GET "/api/lists/$listId"
    Report 'GET /api/lists/<id> returns the list' ($r.Status -eq 200) "got $($r.Status)"
    Report 'total matches the objects added' `
        ($r.Body.total -eq $ObjectIds.Count) "total $($r.Body.total)"
    Report 'summary is present (advanced query 1)' `
        ($null -ne $r.Body.summary) 'summary missing'
    Report 'visibility is populated for a located list (advanced query 2)' `
        ($r.Body.visibility.Count -gt 0) `
        'visibility empty -- expected rows, since this list has coordinates'

    Wait-ForCheck "$($ObjectIds.Count) objects added -- ObjectCount changed, and the detail route now returns summary + visibility" `
        "$BaseUrl/api/lists/$listId" `
        "SELECT ObjectID, ObservedStatus, AddedAt FROM SavedObject WHERE ListID = $listId;"

    # --- Update -----------------------------------------------------------
    $r = Invoke-Api PATCH "/api/lists/$listId" @{ list_name = "$listName (renamed)" }
    Report 'PATCH renames the list' `
        (($r.Status -eq 200) -and ($r.Body.data.ListName -eq "$listName (renamed)")) `
        "got $($r.Status)"
    Report 'PATCH leaves unsent fields alone' `
        ($r.Body.data.Latitude -eq 40.1164) "latitude is now $($r.Body.data.Latitude)"

    Wait-ForCheck "list renamed to '$listName (renamed)' -- note the coordinates are untouched" `
        "$BaseUrl/api/users/$UserId/lists" `
        "SELECT ListID, ListName, Latitude, Longitude FROM ObservationList WHERE ListID = $listId;"

    $r = Invoke-Api PATCH "/api/lists/$listId" @{}
    Report 'PATCH with an empty body is rejected (400)' ($r.Status -eq 400) "got $($r.Status)"

    $r = Invoke-Api PATCH '/api/lists/999999' @{ list_name = 'Ghost' }
    Report 'PATCH on a missing list is 404' ($r.Status -eq 404) "got $($r.Status)"

    # --- Delete -----------------------------------------------------------
    $r = Invoke-Api DELETE "/api/lists/$listId/objects/$($ObjectIds[0])"
    Report 'removes one saved object' ($r.Status -eq 200) "got $($r.Status)"

    $r = Invoke-Api DELETE "/api/lists/$listId/objects/$($ObjectIds[0])"
    Report 'removing it twice is 404' ($r.Status -eq 404) "got $($r.Status)"

    $r = Invoke-Api DELETE "/api/lists/999999/objects/$($ObjectIds[0])"
    Report 'removing from a missing list is 404' ($r.Status -eq 404) "got $($r.Status)"

    # Deliberately the same COUNT query the post-delete pause uses. Running it
    # here first gives the cascade check a "before" number to compare against
    # -- a bare 0 afterwards proves nothing on its own.
    Wait-ForCheck "object $($ObjectIds[0]) removed. Run the mysql query and note the count -- you'll run the identical query again after the list is deleted" `
        "$BaseUrl/api/lists/$listId" `
        "SELECT COUNT(*) AS saved_objects FROM SavedObject WHERE ListID = $listId;"

    # Nothing in the route deletes SavedObject rows -- ON DELETE CASCADE on
    # the foreign key does. objects_removed is the only visible proof it ran.
    $expectedCascade = $ObjectIds.Count - 1
    $r = Invoke-Api DELETE "/api/lists/$listId"
    Report "deleting the list cascades to its $expectedCascade objects" `
        (($r.Status -eq 200) -and ($r.Body.data.objects_removed -eq $expectedCascade)) `
        "status $($r.Status), objects_removed $($r.Body.data.objects_removed)"

    # The browser can only show the list is gone. No route can prove the child
    # rows went with it -- every route that reads SavedObject checks the list
    # exists first, so orphaned rows would be invisible to the API. Only SQL
    # can answer this, which is the point worth making in a demo.
    Wait-ForCheck "list deleted. Run that IDENTICAL count query again -- it was $expectedCascade a moment ago, now it's 0, and nothing in the code deleted those rows" `
        "$BaseUrl/api/lists/$listId  (404s now -- proves the list is gone, says nothing about its objects)" `
        "SELECT COUNT(*) AS saved_objects FROM SavedObject WHERE ListID = $listId;"

    $listId = $null

    $r = Invoke-Api DELETE '/api/lists/999999'
    Report 'deleting a missing list is 404' ($r.Status -eq 404) "got $($r.Status)"
}
finally {
    # If an assertion above blew up partway, the test list would otherwise be
    # left behind and the next run would still work (timestamped name) but
    # clutter would accumulate.
    if ($listId) {
        Write-Host ""
        Write-Host "Cleaning up ListID $listId" -ForegroundColor DarkGray
        $null = Invoke-Api DELETE "/api/lists/$listId"
    }
}

Write-Host ""
if ($script:failed -eq 0) {
    Write-Host "$($script:passed) passed, 0 failed" -ForegroundColor Green
    exit 0
}

Write-Host "$($script:passed) passed, $($script:failed) failed" -ForegroundColor Red
exit 1

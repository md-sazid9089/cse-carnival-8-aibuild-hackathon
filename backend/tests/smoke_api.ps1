# CampusOS judge-simulation smoke tests (API level). Run with backend on :8000.
$ErrorActionPreference = "Continue"
$B = "http://localhost:8000"
$results = @()

function Call($method, $path, $body) {
    try {
        $p = @{ Uri = "$B$path"; Method = $method; UseBasicParsing = $true }
        if ($body) { $p.Body = ($body | ConvertTo-Json -Compress -Depth 5); $p.ContentType = "application/json" }
        $r = Invoke-WebRequest @p
        return @{ status = [int]$r.StatusCode; body = $r.Content }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $sr = New-Object IO.StreamReader($resp.GetResponseStream())
            return @{ status = [int]$resp.StatusCode; body = $sr.ReadToEnd() }
        }
        return @{ status = 0; body = $_.Exception.Message }
    }
}
function Check($name, $cond, $evidence) {
    $script:results += [pscustomobject]@{ test = $name; pass = $cond; evidence = ($evidence -replace "\s+", " ").Substring(0, [Math]::Min(140, ($evidence -replace "\s+", " ").Length)) }
}

# --- Baseline counts
foreach ($e in @(@("schedules", 24), @("rooms", 20), @("events", 7), @("announcements", 8), @("assignments", 8))) {
    $r = Call GET "/api/$($e[0])"
    $n = ($r.body | ConvertFrom-Json).Count
    Check "GET /api/$($e[0]) count=$($e[1])" ($n -eq $e[1]) "count=$n"
}

# --- Shape
$rooms = (Call GET "/api/rooms").body | ConvertFrom-Json
Check "rooms nest bookings[]" ($null -ne ($rooms | Where-Object { $_.id -eq "room-006" }).bookings) "room-006 bookings=$((($rooms | ? id -eq room-006).bookings | ConvertTo-Json -Compress))"
$events = (Call GET "/api/events").body | ConvertFrom-Json
Check "events keep seed registered=47" (($events | ? id -eq evt-001).registered -eq 47) "registered=$(($events | ? id -eq evt-001).registered)"
Check "times serialized HH:MM" ((($rooms | ? id -eq room-006).bookings[0].start_time) -eq "13:00") "start_time=$(($rooms | ? id -eq room-006).bookings[0].start_time)"

# --- CRUD schedule
$r = Call POST "/api/schedules" @{ course = "QA 101"; title = "QA Test"; day = "Monday"; start_time = "08:00"; end_time = "08:50"; room = "7A01"; instructor = "QA"; section = "Q" }
$sid = ($r.body | ConvertFrom-Json).id
Check "POST schedule -> 200 + id" ($r.status -eq 200 -and $sid -like "sch-*") "status=$($r.status) id=$sid"
$r = Call PUT "/api/schedules/$sid" @{ room = "7A02" }
Check "PUT schedule partial update" (($r.body | ConvertFrom-Json).room -eq "7A02") $r.body
$r = Call DELETE "/api/schedules/$sid"
Check "DELETE schedule" ($r.status -eq 200) $r.body
$r = Call GET "/api/schedules"
Check "schedule gone after delete" (-not (($r.body | ConvertFrom-Json) | ? id -eq $sid)) "count=$(($r.body | ConvertFrom-Json).Count)"

# --- Validation (must be 4xx, never 500)
$r = Call POST "/api/schedules" @{ course = "X"; title = "X"; day = "Friday"; start_time = "08:00"; end_time = "09:00"; room = "7A01"; instructor = "X"; section = "X" }
Check "invalid enum day=Friday -> 400" ($r.status -eq 400) "status=$($r.status) $($r.body)"
$r = Call POST "/api/schedules" @{ course = "X"; title = "X"; day = "Monday"; start_time = "25:99"; end_time = "09:00"; room = "7A01"; instructor = "X"; section = "X" }
Check "bad time 25:99 -> 400" ($r.status -eq 400) "status=$($r.status) $($r.body)"
$r = Call POST "/api/schedules" @{ course = "X" }
Check "missing fields -> 400" ($r.status -eq 400) "status=$($r.status) $($r.body)"
$r = Call PUT "/api/schedules/sch-999" @{ room = "X" }
Check "PUT nonexistent -> 404" ($r.status -eq 404) "status=$($r.status)"
$r = Call POST "/api/rooms" @{ room_number = "QA1"; type = "classroom"; capacity = "abc"; equipment = @("x"); floor = 7 }
Check "capacity='abc' -> 4xx not 500" ($r.status -ge 400 -and $r.status -lt 500) "status=$($r.status) $($r.body)"
$r = Call POST "/api/rooms" @{ room_number = "QA2"; type = "classroom"; capacity = -5; equipment = @("x"); floor = 7 }
Check "capacity=-5 -> 4xx not 500" ($r.status -ge 400 -and $r.status -lt 500) "status=$($r.status) $($r.body)"
if ($r.status -eq 200) { Call DELETE "/api/rooms/$(($r.body | ConvertFrom-Json).id)" | Out-Null }
$r = Call POST "/api/rooms" @{ room_number = "QA3"; type = "classroom"; capacity = 10; equipment = "notalist"; floor = 7 }
Check "equipment=string -> 4xx not 500" ($r.status -ge 400 -and $r.status -lt 500) "status=$($r.status) $($r.body)"
if ($r.status -eq 200) { Call DELETE "/api/rooms/$(($r.body | ConvertFrom-Json).id)" | Out-Null }

# --- Booking conflicts (bk-002: 7B04 2026-09-05 14:00-16:00, room-011)
$r = Call POST "/api/rooms/room-011/bookings" @{ date = "2026-09-05"; start_time = "14:30"; end_time = "15:30"; purpose = "QA"; booked_by = "QA" }
Check "overlap bk-002 -> 409 ROOM_CONFLICT" ($r.status -eq 409) "status=$($r.status) $($r.body)"
$r = Call POST "/api/rooms/room-011/bookings" @{ date = "2026-09-05"; start_time = "16:00"; end_time = "17:00"; purpose = "QA"; booked_by = "QA" }
Check "adjacent 16:00-17:00 -> 200" ($r.status -eq 200) "status=$($r.status) $($r.body)"
if ($r.status -eq 200) { $bid = ($r.body | ConvertFrom-Json).booking_id
    $r2 = Call DELETE "/api/rooms/room-011/bookings/$bid?booked_by=Someone%20Else"
    Check "cancel other's booking -> 403" ($r2.status -eq 403) "status=$($r2.status) $($r2.body)"
    $r2 = Call DELETE "/api/rooms/room-011/bookings/$bid?booked_by=QA"
    Check "cancel own booking -> 200" ($r2.status -eq 200) "status=$($r2.status)"
}
# timetable conflict: 7A07 (room-007) Sunday 2026-09-06 13:00 CSE 4113
$r = Call POST "/api/rooms/room-007/bookings" @{ date = "2026-09-06"; start_time = "13:00"; end_time = "14:00"; purpose = "QA"; booked_by = "QA" }
Check "class timetable conflict -> 409" ($r.status -eq 409 -and $r.body -like "*CSE 4113*") "status=$($r.status) $($r.body)"
$r = Call POST "/api/rooms/room-007/bookings" @{ date = "2026-09-05"; start_time = "13:00"; end_time = "14:00"; purpose = "QA"; booked_by = "QA" }
Check "Saturday same slot -> 200 (no class)" ($r.status -eq 200) "status=$($r.status) $($r.body)"
if ($r.status -eq 200) { Call DELETE "/api/rooms/room-007/bookings/$(($r.body | ConvertFrom-Json).booking_id)?booked_by=QA" | Out-Null }
# event venue conflict: evt-003 7A04 (room-004) 2026-09-06 16:00-18:00
$r = Call POST "/api/rooms/room-004/bookings" @{ date = "2026-09-06"; start_time = "17:00"; end_time = "18:00"; purpose = "QA"; booked_by = "QA" }
Check "event venue conflict -> 409" ($r.status -eq 409) "status=$($r.status) $($r.body)"
# bad inputs
$r = Call POST "/api/rooms/room-001/bookings" @{ date = "2026-13-45"; start_time = "10:00"; end_time = "11:00"; purpose = "QA"; booked_by = "QA" }
Check "bad date -> 400" ($r.status -eq 400) "status=$($r.status) $($r.body)"
$r = Call POST "/api/rooms/room-001/bookings" @{ date = "2026-09-08"; start_time = "9:00"; end_time = "11:00"; purpose = "QA"; booked_by = "QA" }
Check "time 9:00 -> 400" ($r.status -eq 400) "status=$($r.status)"
$r = Call POST "/api/rooms/room-001/bookings" @{ date = "2026-09-08"; start_time = "10:00"; end_time = "10:00"; purpose = "QA"; booked_by = "QA" }
Check "start==end -> 400" ($r.status -eq 400) "status=$($r.status)"

# --- Registrations
$r = Call POST "/api/events/evt-006/registrations" @{ student_id = "99-00001"; name = "QA" }
Check "register full evt-006 -> 409 EVENT_FULL" ($r.status -eq 409 -and $r.body -like "*EVENT_FULL*") "status=$($r.status) $($r.body)"
$r = Call POST "/api/events/evt-002/registrations" @{ student_id = "20-40532"; name = "Sakibul Hassan" }
Check "duplicate registration -> 409" ($r.status -eq 409) "status=$($r.status) $($r.body)"
$r = Call POST "/api/events/evt-004/registrations" @{ student_id = "99-00001"; name = "QA" }
Check "register evt-004 -> registered 23" (($r.body | ConvertFrom-Json).registered -eq 23) "registered=$(($r.body | ConvertFrom-Json).registered)"
$r = Call DELETE "/api/events/evt-004/registrations/99-00001"
Check "cancel -> registered 22" (($r.body | ConvertFrom-Json).registered -eq 22) "registered=$(($r.body | ConvertFrom-Json).registered)"
# capacity-1 event flips to full and back
$r = Call POST "/api/events" @{ name = "QA Tiny"; description = "qa"; date = "2026-09-20"; start_time = "10:00"; end_time = "11:00"; venue = "7A01"; organizer = "QA"; capacity = 1 }
$eid = ($r.body | ConvertFrom-Json).id
$r = Call POST "/api/events/$eid/registrations" @{ student_id = "99-00002"; name = "QA2" }
Check "cap-1 event flips to full" (($r.body | ConvertFrom-Json).status -eq "full") "status=$(($r.body | ConvertFrom-Json).status)"
$r = Call POST "/api/events/$eid/registrations" @{ student_id = "99-00003"; name = "QA3" }
Check "second register -> 409" ($r.status -eq 409) "status=$($r.status)"
$r = Call DELETE "/api/events/$eid/registrations/99-00002"
Check "cancel flips back to upcoming" (($r.body | ConvertFrom-Json).status -eq "upcoming") "status=$(($r.body | ConvertFrom-Json).status)"
Call DELETE "/api/events/$eid" | Out-Null
$r = Call PUT "/api/events/evt-001" @{ registered = 0 }
Check "mass-assign registered ignored" (($r.body | ConvertFrom-Json).registered -eq 47) "registered=$(($r.body | ConvertFrom-Json).registered)"

# --- Search live-data + SQLi
$orig = ((Call GET "/api/announcements").body | ConvertFrom-Json | ? id -eq ann-007).body
$r = Call PUT "/api/announcements/ann-007" @{ body = "$orig ZEBRAFISH" }
Start-Sleep 1
$r = Call GET "/api/search?q=ZEBRAFISH"
Check "search finds fresh edit (keyword leg)" ((($r.body | ConvertFrom-Json) | ? entity_id -eq ann-007) -ne $null) $r.body
Call PUT "/api/announcements/ann-007" @{ body = $orig } | Out-Null
$r = Call GET "/api/search?q=');DROP%20TABLE%20schedules;--"
$n = ((Call GET "/api/schedules").body | ConvertFrom-Json).Count
Check "SQLi via search harmless" ($r.status -eq 200 -and $n -eq 24) "status=$($r.status) schedules=$n"
$r = Call GET "/api/schedules?course=%27%20OR%201%3D1%20--"
Check "SQLi via filter harmless" ($r.status -eq 200 -and (($r.body | ConvertFrom-Json).Count -eq 0)) "status=$($r.status) count=$(($r.body | ConvertFrom-Json).Count)"

# --- Agent error path (placeholder key)
$r = Call POST "/api/agent/chat" @{ messages = @(@{ role = "user"; content = "When is my next class?" }); profile = @{ student_id = "20-40532"; name = "Sakibul Hassan" } }
Check "agent w/ bad key -> clean JSON not 500" ($r.status -ne 500 -and $r.body -like "*reply*") "status=$($r.status) $($r.body)"

# --- API 404 shape
$r = Call GET "/api/doesnotexist"
Check "/api/unknown -> JSON 404" ($r.status -eq 404 -and $r.body -like "{*") "status=$($r.status) $($r.body)"

# --- final counts
foreach ($e in @(@("schedules", 24), @("rooms", 20), @("events", 7), @("announcements", 8), @("assignments", 8))) {
    $n = ((Call GET "/api/$($e[0])").body | ConvertFrom-Json).Count
    Check "cleanup: $($e[0]) back to $($e[1])" ($n -eq $e[1]) "count=$n"
}

$results | Format-Table -AutoSize -Wrap | Out-String -Width 220
$pass = ($results | ? pass).Count; $total = $results.Count
Write-Host "PASSED $pass / $total"

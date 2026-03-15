@echo off
setlocal

REM Run from this script's directory (project root)
cd /d "%~dp0"

REM Stop stale node dev processes that block expected ports
powershell -NoProfile -Command "$ports = @(8080,3000); foreach ($port in $ports) { $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue; foreach ($listener in $listeners) { $proc = Get-Process -Id $listener.OwningProcess -ErrorAction SilentlyContinue; if ($proc -and $proc.ProcessName -eq 'node') { Stop-Process -Id $proc.Id -Force; Write-Output ('Stopped node PID ' + $proc.Id + ' on port ' + $port); } elseif ($proc) { Write-Output ('Port ' + $port + ' is in use by ' + $proc.ProcessName + ' (PID ' + $proc.Id + ').'); } } }"

REM Start the WebSocket backend in a separate terminal window
start "Expense Tracker WS Server" /D "%~dp0" cmd /k "npm run ws:server"

REM Start the Next.js development server in this window
npm run dev

endlocal
pause
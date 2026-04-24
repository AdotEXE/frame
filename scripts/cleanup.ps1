# Frame legacy cleanup — fallback for processes started before PID tracking.
# Targets ONLY: electron.exe whose ExecutablePath is inside frame.
# Explicitly skips anything listening on Protocol XT ports (5001 / 8000 / 9000).
# Safe — never matches bash/powershell/cmd/npm/node by mistake.

$ErrorActionPreference = 'SilentlyContinue'
$ProtectedPorts = @(5001, 8000, 9000)

$candidates = Get-CimInstance Win32_Process | Where-Object {
    $_.Name -eq 'electron.exe' -and $_.ExecutablePath -and $_.ExecutablePath -like '*frame*'
}

if (-not $candidates) {
    Write-Host "[legacy-cleanup] no orphan electron processes from frame"
    exit 0
}

$killed = 0
$skipped = 0

foreach ($proc in $candidates) {
    $procPid = $proc.ProcessId

    $listening = Get-NetTCPConnection -OwningProcess $procPid -State Listen -ErrorAction SilentlyContinue
    $hitsProtected = $false
    foreach ($conn in $listening) {
        if ($ProtectedPorts -contains $conn.LocalPort) {
            $hitsProtected = $true
            break
        }
    }

    if ($hitsProtected) {
        Write-Host "[legacy-cleanup] SKIP pid $procPid - listens on protected port"
        $skipped++
        continue
    }

    try {
        Stop-Process -Id $procPid -Force -ErrorAction Stop
        Write-Host "[legacy-cleanup] killed orphan electron pid $procPid"
        $killed++
    } catch {
        Write-Host "[legacy-cleanup] could not kill pid $procPid : $_"
    }
}

Write-Host "[legacy-cleanup] done - killed $killed, skipped $skipped"
exit 0

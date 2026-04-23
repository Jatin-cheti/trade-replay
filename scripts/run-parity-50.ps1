param(
    [int]$Target = 50
)

Set-Location "C:\Users\mohit\Desktop\trade-replay\harshit-repo"

$pass = 0
$fail = 0
$run = 0
$failLog = @()

Write-Host "=== Parity 50-run loop ===" -ForegroundColor Cyan
Write-Host "Target: $Target passes`n"

while ($pass -lt $Target) {
    $run++
    Write-Host "--- Run #$run  (pass=$pass fail=$fail) ---" -ForegroundColor Yellow

    # Kill leftover node processes
    Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2

    $output = npx.cmd playwright test `
        -c "tests/integration/e2e/playwright.config.ts" `
        --project=chromium `
        --reporter=list `
        --grep "capture tradingview parity" 2>&1
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
        $pass++
        Write-Host "[PASS] Run #$run  total-pass=$pass" -ForegroundColor Green
    } else {
        $fail++
        $errorLines = $output | Where-Object { $_ -match "Error|failed|stableFrames|stabilize|expect|✘" }
        $summary = ($errorLines | Select-Object -First 10) -join "`n"
        $failLog += "Run #$run`n$summary`n"
        Write-Host "[FAIL] Run #$run  total-fail=$fail" -ForegroundColor Red
        Write-Host $summary -ForegroundColor DarkRed
        Write-Host ""

        # Save failure detail to file for analysis
        $logFile = "scripts\parity-fail-run$run.txt"
        $output | Out-File $logFile -Encoding utf8
        Write-Host "  Details saved to $logFile" -ForegroundColor DarkYellow
    }

    Write-Host ""
}

Write-Host "=== DONE ===" -ForegroundColor Cyan
Write-Host "Runs: $run   Pass: $pass   Fail: $fail" -ForegroundColor White
if ($failLog.Count -gt 0) {
    Write-Host "`nFailure summary:"
    $failLog | ForEach-Object { Write-Host $_ -ForegroundColor DarkRed }
}

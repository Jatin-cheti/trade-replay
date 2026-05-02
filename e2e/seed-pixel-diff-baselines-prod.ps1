# pixel-diff baseline seeding for PRODUCTION (https://tradereplay.me)
#
# Steps performed automatically:
#   1. POST /api/auth/register (or /login) to get a fresh JWT from prod API
#   2. Set E2E_PROD_TOKEN so the factory injects sim_token before navigation
#   3. Run all 17 line/channel/pitchfork tools with --update-snapshots
#
# Required env vars (set before running, or hardcode below):
#   E2E_PROD_EMAIL    – email for a valid prod account  (default: e2e-test@tradereplay.me)
#   E2E_PROD_PASSWORD – password for that account       (default: TestPass123!)
#
# The snapshot files land in the SAME paths as localhost baselines:
#   e2e/tv-parity-<tool>-500.spec.ts-snapshots/<tool>-state-NNN-chromium-win32.png
# They OVERWRITE the localhost baselines (that is intentional – prod is truth).

$ErrorActionPreference = "Continue"

# ── credentials ───────────────────────────────────────────────────────────────
$prodEmail    = if ($env:E2E_PROD_EMAIL)    { $env:E2E_PROD_EMAIL    } else { "e2e-test@tradereplay.me" }
$prodPassword = if ($env:E2E_PROD_PASSWORD) { $env:E2E_PROD_PASSWORD } else { "TestPass123!" }
$prodApiBase  = "https://api.tradereplay.me"

# ── get JWT ───────────────────────────────────────────────────────────────────
Write-Host "=== Fetching prod JWT for $prodEmail ==="
$body = @{ email = $prodEmail; password = $prodPassword; name = "e2e-test" } | ConvertTo-Json

# Try register first (idempotent – fails gracefully if account exists)
try {
  $regResp = Invoke-RestMethod -Uri "$prodApiBase/api/auth/register" `
    -Method Post -ContentType "application/json" -Body $body -ErrorAction SilentlyContinue
  $token = $regResp.token
  Write-Host "Registered (or already existed) – got token."
} catch { $token = $null }

# Fall back to login if register returned no token
if (-not $token) {
  try {
    $loginBody = @{ email = $prodEmail; password = $prodPassword } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "$prodApiBase/api/auth/login" `
      -Method Post -ContentType "application/json" -Body $loginBody
    $token = $loginResp.token
    Write-Host "Login succeeded – got token."
  } catch {
    Write-Error "Could not obtain prod JWT. Check E2E_PROD_EMAIL / E2E_PROD_PASSWORD."
    exit 1
  }
}

if (-not $token) {
  Write-Error "Token is empty. Aborting."
  exit 1
}

Write-Host "JWT obtained (length $($token.Length))."

# ── env for factory ───────────────────────────────────────────────────────────
$env:E2E_PROD_TOKEN  = $token
$env:E2E_TARGET_URL  = "https://tradereplay.me"
$env:E2E_PIXEL_DIFF  = "1"

# ── tool list (17 tools) ──────────────────────────────────────────────────────
$tools = @(
  # Lines (9)
  "trend", "ray", "infoLine", "extendedLine", "trendAngle",
  "hline", "horizontalRay", "vline", "crossLine",
  # Channels (4)
  "channel", "regressionTrend", "flatTopBottom", "disjointChannel",
  # Pitchforks (4)
  "pitchfork", "schiffPitchfork", "modifiedSchiffPitchfork", "insidePitchfork"
)

$summary = "e2e\pixel-diff-prod-summary.txt"
if (Test-Path $summary) { Remove-Item $summary -Force }
"started=$(Get-Date -Format o)" | Out-File -FilePath $summary -Encoding ascii
"target=https://tradereplay.me" | Out-File -FilePath $summary -Append -Encoding ascii

# ── run each tool ─────────────────────────────────────────────────────────────
foreach ($tool in $tools) {
  $spec = "e2e/tv-parity-$tool-500.spec.ts"
  if (-not (Test-Path $spec)) {
    Write-Host "SKIP $tool – spec not found"
    "SKIP,$tool,no-spec" | Out-File -FilePath $summary -Append -Encoding ascii
    continue
  }

  $start = Get-Date
  Write-Host ""
  Write-Host "=== START $tool  $(Get-Date -Format 'HH:mm:ss') ==="
  "START,$tool,$($start.ToString('o'))" | Out-File -FilePath $summary -Append -Encoding ascii

  npx playwright test $spec `
    --project=chromium `
    --config=e2e/playwright.prod-parity.config.ts `
    --workers=1 `
    --reporter=dot `
    --update-snapshots `
    --grep "geometry #" `
    *> "e2e\pixel-diff-prod-$tool.log"

  $exit = $LASTEXITCODE
  $dur = [math]::Round(((Get-Date) - $start).TotalMinutes, 2)
  $verdict = if ($exit -eq 0) { "PASS" } else { "FAIL" }
  Write-Host "  $verdict  (${dur}m, exit=$exit)"
  "RESULT,$tool,$verdict,${dur}m,exit=$exit" | Out-File -FilePath $summary -Append -Encoding ascii

  # Refresh token every 5 tools to avoid expiry mid-run
  $toolIndex = [array]::IndexOf($tools, $tool) + 1
  if ($toolIndex % 5 -eq 0) {
    try {
      $refreshBody = @{ email = $prodEmail; password = $prodPassword } | ConvertTo-Json
      $refreshResp = Invoke-RestMethod -Uri "$prodApiBase/api/auth/login" `
        -Method Post -ContentType "application/json" -Body $refreshBody
      if ($refreshResp.token) {
        $env:E2E_PROD_TOKEN = $refreshResp.token
        Write-Host "  Token refreshed."
      }
    } catch { Write-Host "  Token refresh failed (continuing with existing token)." }
  }
}

"finished=$(Get-Date -Format o)" | Out-File -FilePath $summary -Append -Encoding ascii

# ── print summary ─────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "=== PROD PIXEL-DIFF SEED SUMMARY ==="
Get-Content $summary

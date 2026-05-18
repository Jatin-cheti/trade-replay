# pixel-diff baseline seeding
# Runs each line/channel/pitchfork tool's tv-parity 500-suite with E2E_PIXEL_DIFF=1
# and --update-snapshots to seed baseline images, logging per-tool result + duration.

$ErrorActionPreference = "Continue"
$summary = "e2e\pixel-diff-baseline-summary.txt"
if (Test-Path $summary) { Remove-Item $summary -Force }
"started=$(Get-Date -Format o)" | Out-File -FilePath $summary -Encoding ascii

$tools = @(
  # Lines (9)
  "trend", "ray", "infoLine", "extendedLine", "trendAngle",
  "hline", "horizontalRay", "vline", "crossLine",
  # Channels (4)
  "channel", "regressionTrend", "flatTopBottom", "disjointChannel",
  # Pitchforks (4)
  "pitchfork", "schiffPitchfork", "modifiedSchiffPitchfork", "insidePitchfork"
)

$env:E2E_PIXEL_DIFF = "1"
$env:E2E_TARGET_URL = "http://localhost:8080"

foreach ($tool in $tools) {
  $spec = "e2e/tv-parity-$tool-500.spec.ts"
  if (-not (Test-Path $spec)) {
    "SKIP,$tool,no-spec" | Out-File -FilePath $summary -Append -Encoding ascii
    continue
  }
  $start = Get-Date
  "START,$tool,$($start.ToString('o'))" | Out-File -FilePath $summary -Append -Encoding ascii

  # Only run the geometry sub-suite (100 tests) for pixel-diff seeding;
  # other suites (selection/edge/modifier/etc) don't add image assertions.
  npx playwright test $spec `
    --project=chromium `
    --config=e2e/playwright.local-preview.config.ts `
    --workers=1 `
    --reporter=dot `
    --update-snapshots `
    --grep "geometry #" `
    *> "e2e\pixel-diff-$tool.log"

  $exit = $LASTEXITCODE
  $dur = [math]::Round(((Get-Date) - $start).TotalMinutes, 2)
  $verdict = if ($exit -eq 0) { "PASS" } else { "FAIL" }
  "RESULT,$tool,$verdict,${dur}m,exit=$exit" | Out-File -FilePath $summary -Append -Encoding ascii
}

"finished=$(Get-Date -Format o)" | Out-File -FilePath $summary -Append -Encoding ascii

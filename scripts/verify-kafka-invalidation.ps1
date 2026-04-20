param(
  [string]$ChartServiceUrl = "http://127.0.0.1:4010",
  [string]$Symbol = "AAPL",
  [string]$Timeframe = "1m"
)

$bundleUrl = "$ChartServiceUrl/bundle"
$body = @{
  source = @{
    symbol = $Symbol
    timeframe = $Timeframe
    from = "2025-01-01T00:00:00.000Z"
    to = "2025-01-01T00:10:00.000Z"
  }
  transformType = "renko"
  params = @{ boxSize = 0.5 }
  indicators = @(@{ id = "sma"; params = @{ period = 20 } })
} | ConvertTo-Json -Depth 10

$headers = @{ "content-type" = "application/json" }

$first = Invoke-RestMethod -Uri $bundleUrl -Method Post -Headers $headers -Body $body
$second = Invoke-RestMethod -Uri $bundleUrl -Method Post -Headers $headers -Body $body

if (-not $second.cached) {
  throw "Expected second /bundle call to be cached=true"
}

npm --prefix backend exec tsx scripts/publishChartCandleUpdate.ts --symbol=$Symbol --timeframe=$Timeframe | Out-Host

$third = $null
for ($i = 0; $i -lt 10; $i++) {
  $third = Invoke-RestMethod -Uri $bundleUrl -Method Post -Headers $headers -Body $body
  if (-not $third.cached) {
    break
  }
}

if ($null -eq $third -or $third.cached) {
  throw "Expected /bundle to become cache miss after candle.updated"
}

Write-Host "Verification passed"
Write-Host "first.cached=$($first.cached) second.cached=$($second.cached) third.cached=$($third.cached)"

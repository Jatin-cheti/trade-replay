# Chart Service Streaming and Caching

## Overview

Phase 2 makes chart-service the primary compute and cache layer for chart indicator, transform, and bundle requests.

- Deterministic cache keys are versioned with the `v1:chart:*` namespace.
- Redis is primary cache backend with in-memory fallback when Redis is unavailable.
- Stale-while-revalidate behavior reduces latency while refreshing stale entries in the background.
- Optional Kafka streaming invalidates symbol and timeframe windows on candle updates.

## Cache Key Formats

- Candles: `v1:chart:candles:{symbol}:{tf}:{from}:{to}`
- Transform: `v1:chart:transform:{type}:{paramsHash}:{symbol}:{tf}:{from}:{to}`
- Indicators: `v1:chart:indicators:{indicatorsHash}:{symbol}:{tf}:{from}:{to}`
- Bundle: `v1:chart:bundle:{type}:{paramsHash}:{indicatorsHash}:{symbol}:{tf}:{from}:{to}`

## TTL Policy

- Live windows use `CHART_CACHE_LIVE_TTL_SECONDS` (default 15s).
- Historical windows use `CHART_CACHE_HISTORICAL_TTL_SECONDS` (default 900s).
- SWR grace uses `CHART_CACHE_SWR_SECONDS` (default 30s).

A request in SWR grace serves stale payload and schedules background refresh.

## Endpoints

- `POST /api/chart/compute/indicators`
- `POST /api/chart/transform`
- `POST /api/chart/bundle`
- `GET /api/chart/candles`
- `GET /api/chart/realtime/:symbol`
- `GET /health`

Backend proxy routes:

- `POST /api/chart/compute/indicators`
- `POST /api/chart/transform`
- `POST /api/chart/bundle`

Public Nginx health route:

- `GET /api/chart/health` (proxied to chart-service `/health`)

## Streaming

Chart-service starts a Kafka consumer when `KAFKA_ENABLED=true`.

- Topic: `CHART_CANDLE_UPDATE_TOPIC` (default `chart.candle.updated`)
- Event payload:

```json
{
  "symbol": "AAPL",
  "timeframe": "1m",
  "from": "2025-01-01T00:00:00.000Z",
  "to": "2025-01-01T01:00:00.000Z"
}
```

On event receipt, chart-service invalidates matching cache keys by `symbol` and `timeframe`.

## Environment

Chart-service variables:

- `CHART_CACHE_TTL_SECONDS`
- `CHART_CACHE_LIVE_TTL_SECONDS`
- `CHART_CACHE_HISTORICAL_TTL_SECONDS`
- `CHART_CACHE_SWR_SECONDS`
- `KAFKA_ENABLED`
- `KAFKA_BROKERS`
- `CHART_CANDLE_UPDATE_TOPIC`
- `CHART_KAFKA_CLIENT_ID`
- `CHART_KAFKA_GROUP_ID`

Backend variables:

- `CHART_SERVICE_ENABLED`
- `CHART_SERVICE_URL`
- `CHART_SERVICE_TIMEOUT_MS`

## cURL Examples

Compute indicators:

```bash
curl -X POST http://localhost:4010/api/chart/compute/indicators \
  -H "content-type: application/json" \
  -d '{
    "source": {"symbol":"AAPL","timeframe":"1m","from":"2025-01-01T00:00:00.000Z","to":"2025-01-01T01:00:00.000Z"},
    "indicators": [{"id":"sma","params":{"period":20}}]
  }'
```

Compute bundle:

```bash
curl -X POST http://localhost:4010/api/chart/bundle \
  -H "content-type: application/json" \
  -d '{
    "source": {"symbol":"AAPL","timeframe":"1m","from":"2025-01-01T00:00:00.000Z","to":"2025-01-01T01:00:00.000Z"},
    "transformType":"renko",
    "params":{"boxSize":0.5},
    "indicators":[{"id":"sma","params":{"period":20}}]
  }'
```

Via backend proxy:

```bash
curl -X POST http://localhost:4000/api/chart/bundle \
  -H "content-type: application/json" \
  -H "authorization: Bearer <token>" \
  -d '{
    "source": {"symbol":"AAPL","timeframe":"1m"},
    "transformType":"rangeBars",
    "params":{"rangeSize":1},
    "indicators":[{"id":"ema","params":{"period":21}}]
  }'
```

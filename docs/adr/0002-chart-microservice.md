# ADR 0002: Chart Microservice for Compute, Transforms, and Caching

## Status
Accepted (Phase 1)

## Context
The browser must keep chart rendering (canvas/WebGL) because rendering cannot be meaningfully offloaded to a backend microservice without shipping images/frames and increasing latency.

However, non-render workloads are good candidates for microservicing:
- Indicator computation (101 indicators)
- Premium transforms (renko, kagi, point & figure, line break, range bars, brick)
- Cache for computed series
- Streaming and export endpoints in later phases

Upstream main already introduced a microservice pattern for symbol/logo workloads using a dedicated service process, shared infrastructure (Redis/Kafka/Mongo), and docker-compose service wiring.

## Decision
Create a dedicated chart-service that provides compute APIs while keeping frontend rendering unchanged.

Phase 1 scope:
- `GET /health`
- `POST /compute/indicators`
- `POST /transform`
- Redis cache with in-memory fallback
- Backend feature flag integration:
  - `CHART_SERVICE_ENABLED=true`: delegate compute calls to chart-service
  - `CHART_SERVICE_ENABLED=false`: use local backend compute fallback

## API Contract
### POST /compute/indicators
Request:
- `candles`: optional array of OHLCV candles
- `source`: optional source descriptor (`symbol`, `timeframe`, `from`, `to`, `limit`, `authToken`) to fetch candles from main backend
- `indicators`: required array of `{ id, params }`

Response:
- `candlesCount`
- `indicators`: array with metadata and output values
- `cached`: boolean

### POST /transform
Request:
- `candles` or `source`
- `transformType`: `renko|rangeBars|lineBreak|kagi|pointFigure|brick`
- `params`: optional numeric parameters

Response:
- `candlesCount`
- `transformedCount`
- `transformType`
- `candles`
- `cached`: boolean

## Cache Strategy
- Key format: `chart-service:<operation>:<sha1(payload)>`
- TTL: `CHART_CACHE_TTL_SECONDS` (default 120)
- Primary store: Redis
- Fallback: in-memory TTL map when Redis unavailable

## Failure Modes and Fallbacks
- chart-service down/unreachable:
  - backend logs warning
  - backend falls back to local compute path
- Redis down:
  - chart-service continues with in-memory cache
- source candle fetch failure:
  - service returns `NO_CANDLES_AVAILABLE` (400)

## Consequences
Positive:
- Isolates CPU-heavy compute from backend request path
- Enables future horizontal scaling for compute workloads
- Keeps frontend unchanged in Phase 1

Tradeoffs:
- Additional operational surface (service lifecycle, env wiring)
- Duplicate compute capability (service + fallback path) to preserve safety

## Phased Follow-up
- Phase 2:
  - SSE endpoint for chart updates
  - Kafka consumer to refresh indicator/transform caches
  - bundled endpoint for candles+indicators+meta
- Phase 3:
  - export pipeline (data bundle and optional server-side screenshots)

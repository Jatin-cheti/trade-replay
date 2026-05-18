# Instant Search Architecture

## Goal

Make search feel instant even when the symbol is not already in the database.

## Stage Model

### Stage 1: Local Immediate Search

- Search DB / cached prefix results immediately
- Return hits from Redis + Mongo without blocking on external providers
- Cache prefix results and exact-hit results independently

Latency targets:

- p50 under 50ms for warm hits
- p95 under 150ms for cold DB hits

### Stage 2: Search-Miss Resolve

If no hit is found:

- create an in-flight resolver key in Redis
- show a temporary `resolving...` row in the UI immediately
- query external resolvers in priority order by asset class and region
- return a minimum viable hydrated row as soon as identity + exchange + name + assetType are known

### Stage 3: Immediate Persistence

On successful resolve:

- write a minimum viable record to staging or promoted collection with `resolutionState=pending_enrichment`
- include:
  - symbol
  - fullSymbol
  - exchange
  - country
  - type
  - issuer/name
  - source trace
  - logo reference or fallback token
  - key-fields availability flag

### Stage 4: Asynchronous Enrichment

Enqueue jobs for:

- quote enrichment
- fundamentals enrichment
- logo/domain enrichment
- canonical issuer key enrichment
- sector classification

### Stage 5: Seamless UI Hydration

- UI row updates in place when enrichment completes
- repeated searches hit DB/cache and become effectively instant

## Caching Strategy

- Prefix query cache in Redis
- Exact-hit cache for resolved symbol detail
- Negative cache on misses with short TTL to avoid provider hammering
- In-flight request dedupe so identical misses do not spawn duplicate resolver work

Suggested TTLs:

- exact search hit: 5 to 15 minutes
- prefix list: 2 to 5 minutes
- negative miss: 5 minutes
- in-flight lock: 15 to 30 seconds

## Provider Safety

- Per-provider rate limiting
- Retry with exponential backoff
- Dead-letter queue for repeated failures
- Fallback chain by region and asset class
- Resolver output must be schema validated before persistence

## UI States

- hit: immediate row render
- miss-resolving: optimistic placeholder row
- miss-resolved: row hydrates in place
- miss-failed: explicit not-found state with retry cooldown

## Abuse Protection

- IP or session request throttling
- limit search-miss resolution concurrency
- block repeated obviously invalid symbols with negative cache

## Observability

Track:

- search hit rate
- miss rate
- external resolver success rate
- time to first resolved row
- time to fully enriched row
- repeated search cache-hit rate

## Current Gap

Current production has strong hit-path search behavior, but the miss-to-resolve-to-ingest loop is not yet implemented end to end and therefore cannot yet satisfy the acceptance criteria for instant discovery.
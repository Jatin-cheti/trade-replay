# Local Development

This repository supports a self-contained local stack with Docker Compose profiles.

## Runtime Modes

### 1) Full Infra (Docker)

Use Docker for MongoDB, Redis, and Kafka.

- `npm run dev:up`
- `npm run dev:up:full` (includes `logo-service` profile)

### 2) Fallback Mode (No Docker)

Use `npm run app` when Docker is unavailable. In this mode:

- MongoDB falls back to in-memory.
- Redis falls back to mock/cache-disabled mode.
- Kafka is preflight-checked and auto-disabled in dev when unreachable.
- Backend and chart-service still boot and report degraded dependencies in health endpoints.

### 3) Streaming Enabled Explicitly

Chart-service Kafka streaming is disabled in local mode by default.
To enable intentionally:

- `CHART_STREAMING_ENABLED=true`
- `KAFKA_ENABLED=true`
- reachable `KAFKA_BROKER`/`KAFKA_BROKERS`

## Prerequisites

- Docker Desktop running
- Node.js and npm installed

## Environment Files

Required files at repository root:

- .env
- .env.secrets

Validation command:

```bash
npm run env:check
```

## Dev Defaults (Centralized In Env Parsing)

These defaults apply in local development unless explicitly overridden by env variables:

Backend:

- `KAFKA_ENABLED=false`
- `REDIS_ENABLED=false`
- `DEV_DISABLE_KAFKA_IF_UNAVAILABLE=true`
- `LOGO_SERVICE_MODE=remote`

Chart-service:

- `KAFKA_ENABLED=false`
- `CHART_STREAMING_ENABLED=false`
- `REDIS_ENABLED=false`
- `DEV_DISABLE_KAFKA_IF_UNAVAILABLE=true`

Behavior notes:

- If Kafka is enabled but unreachable in local mode, startup logs one summary warning and runtime auto-disables Kafka (no retry storm).
- If Redis is unreachable, error logs are throttled and cache degrades safely.

## Service Groups

Compose profiles are grouped as:

- infra: mongodb, redis, kafka
- apps: backend, worker, kafka-service, chart-service
- logo: logo-service
- tools: prometheus, grafana, jenkins

## Logo Service Modes

Backend logo behavior is controlled by:

- LOGO_SERVICE_ENABLED=true|false
- LOGO_SERVICE_MODE=local|remote|disabled
- LOGO_SERVICE_URL=<remote logo service base URL>

Recommended for chart-engine local development:

- LOGO_SERVICE_ENABLED=true
- LOGO_SERVICE_MODE=remote
- LOGO_SERVICE_URL set in .env.secrets to the production logo-service URL

If you want logo features fully off locally:

- LOGO_SERVICE_ENABLED=false
- LOGO_SERVICE_MODE=disabled

For non-blocking chart-engine local work, keep logo remote or disabled. Do not run local logo-service unless needed.

## Start Commands

Start only infra services:

```bash
npm run dev:infra
```

Start observability and CI tools:

```bash
npm run dev:tools
```

Start local app stack (without logo-service):

```bash
npm run dev:up
```

Start local app stack with logo-service:

```bash
npm run dev:up:full
```

Fallback startup (no Docker required):

```bash
npm run app
```

The `dev:up` command does not start logo-service. `dev:up:full` starts it explicitly via the `logo` profile.

## Stop and Reset

Stop all containers:

```bash
npm run dev:down
```

Stop and wipe local volumes:

```bash
npm run dev:reset
```

Stream service logs:

```bash
npm run dev:logs
```

## Local Endpoints

- Backend health: http://localhost:4000/api/health
- Chart service health: http://localhost:4010/health
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Jenkins: http://localhost:8081

## Troubleshooting Connection Refusals

### localhost:19092 (Kafka)

Meaning:

- Kafka broker is down or not reachable.

What to do:

- In fallback mode, keep `KAFKA_ENABLED=false`.
- If you need Kafka, start infra and verify broker endpoint:
	- `npm run dev:infra`
	- check Kafka container is healthy.
- Keep `DEV_DISABLE_KAFKA_IF_UNAVAILABLE=true` to avoid retry storms.

### 127.0.0.1:6379 (Redis)

Meaning:

- Redis is not running locally.

What to do:

- In fallback mode, keep `REDIS_ENABLED=false` and `DEV_ALLOW_MOCK_REDIS=true`.
- If you need real Redis, start infra and verify port 6379 is listening.

### 127.0.0.1:27017 (MongoDB)

Meaning:

- MongoDB is not running locally.

What to do:

- Fallback mode auto-switches to memory MongoDB when allowed.
- To use real MongoDB, start infra and verify port 27017 is listening.

### EADDRINUSE on 4000/4010/8080

Meaning:

- A previous process is still listening.

What to do:

- Stop old dev processes and re-run `npm run app`.

## Verification Flow

```bash
npm run env:check
npm run dev:up
npm run typecheck
npm run build
npm run test:e2e
```

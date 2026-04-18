# tradereplay

Production-ready monorepo for Trade Replay.

Domain provider: Namecheap

## Final Structure

tradereplay/
- frontend/
- backend/
- services/
- tests/
- docker-compose.yml
- package.json
- README.md
- .env
- .env.secrets (gitignored)

## Architecture

- API service: Express backend handling auth, portfolio, simulation, trading, symbol search.
- Chart microservice: dedicated chart compute, transform, bundle, and realtime stream APIs.
- Logo microservice: dedicated worker for logo enrichment and optional S3/CDN upload.
- Kafka service: consumer/producer worker for analytics and event fan-out.
- Redis queue: BullMQ logo enrichment queue and cache/lock primitives.
- CDN flow: logos may be uploaded to S3 and served from CDN base URL.

## Tech Stack

- Frontend: React + Vite + Tailwind
- Backend: Node.js + TypeScript + Express (MVC)
- Database: MongoDB
- Cache: Redis
- Auth: JWT (Bearer token)
- Realtime: Socket.io

## Backend API Structure

- Auth routes: /api/auth
- Simulation routes (JWT protected): /api/simulation and /api/sim
- Portfolio routes (JWT protected): /api/portfolio
- Trade routes (JWT protected): /api/trade
- Health route: /api/health

Saved portfolio endpoints:

- `GET /api/portfolio` list saved portfolios
- `POST /api/portfolio` create portfolio manually
- `POST /api/portfolio/import` create portfolio from CSV (symbol, quantity, avgPrice)
- `GET /api/portfolio/current` get live simulation account portfolio

Upload endpoint:

- `POST /api/portfolio/upload-url`
- CSV import upload key pattern: `trade-replay/portfolios/{userId}/{timestamp}-{fileName}.csv`
- Deterministic portfolio object upload key pattern (when `portfolioId` is provided): `trade-replay/portfolios/{userId}/{portfolioId}.json`

## Auth Flow

1. Client authenticates via /api/auth/login or /api/auth/register.
2. Backend returns a signed JWT.
3. Client sends Authorization: Bearer <token>.
4. backend/src/middlewares/verifyToken.ts validates JWT and attaches req.user.
5. Protected routes return 401 for missing/invalid token.

## Environment

Use one root `.env` only.

Keep secrets in a separate `.env.secrets` file (gitignored) for local/deployment overrides:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `JWT_SECRET`
- `CURSOR_SIGNING_SECRET`

Recommended additional AWS settings in `.env.secrets`:

- `AWS_REGION`
- `AWS_S3_BUCKET`
- `AWS_CDN_BASE_URL` (optional)

Load order is:

1. `.env`
2. `.env.secrets` (overrides)

Config is validated at startup with Zod; missing required values fail fast.

AWS validation behavior:

- `APP_ENV=production`: `AWS_REGION`, `AWS_S3_BUCKET`, `AWS_ACCESS_KEY_ID`, and `AWS_SECRET_ACCESS_KEY` are mandatory.
- `APP_ENV=local` and `APP_ENV=docker`: AWS settings are optional.
- If any required AWS field is present, all required AWS fields must be present.

Runtime mode is selected using `APP_ENV`:

- `APP_ENV=local` for host/local runs
- `APP_ENV=docker` for Docker Compose runs
- `APP_ENV=production` for host production runs

Mode-specific infra keys are resolved as `<KEY>_<APP_ENV>`:

- `MONGO_URI_LOCAL`, `MONGO_URI_DOCKER`, `MONGO_URI_PRODUCTION`
- `REDIS_URL_LOCAL`, `REDIS_URL_DOCKER`, `REDIS_URL_PRODUCTION`
- `KAFKA_BROKER_LOCAL`, `KAFKA_BROKER_DOCKER`, `KAFKA_BROKER_PRODUCTION`

All non-mode-specific settings remain shared in `.env` (for example: `PORT`, `CLIENT_URL`, `KAFKA_ENABLED`, `GOOGLE_CLIENT_ID`, `ALPHA_VANTAGE_KEY`).
Sensitive values remain in `.env.secrets` only.

Google OAuth client ID is configured for local/dev/qa in `.env`:

- `519388948862-jgnq690fvh4ipig0ujcagbv671b8uvqh.apps.googleusercontent.com`

## Product Flow

Required user journey is now:

1. Login / signup
2. Open dashboard
3. Create or import a saved portfolio
4. Pick scenario per portfolio
5. Launch simulation and trade

## Production Hardening

- Dynamic backend port fallback if `PORT` is busy (tries a range from requested port upward).
- Structured JSON logging for requests, errors, DB/cache startup, and simulation engine events.
- Global error middleware at `backend/src/middlewares/errorHandler.ts` with standard response format:

```json
{
	"success": false,
	"message": "...",
	"errorCode": "..."
}
```

- Migration system at `backend/src/migrations/` with version tracking in the `migrations` collection.
- Modular seeder system at `backend/src/seeders/`.
- Strict TypeScript validation enabled for frontend app config and backend build.

## Operations Commands

```bash
npm run typecheck
npm run migrate
npm run seed
```

## Install

1. Install root tooling:

```bash
npm install
```

2. Install backend and frontend dependencies:

```bash
npm run install:all
```

## Run Apps Together

```bash
npm run app
```

- Frontend: http://localhost:8080
- Backend health: http://localhost:4000/api/health

## Validation

```bash
npm run validate
npm run validate:logo-pipeline
```

`validate:logo-pipeline` performs:

- 100-symbol response-level icon accuracy check
- 500-job queue spike/load check
- queue drain/stall verification

## Docker (Full Stack)

```bash
npm run docker:up
```

Compose services:

- backend
- worker
- chart-service
- logo-service
- kafka-service
- mongodb
- redis
- kafka
- prometheus
- grafana

To stop:

```bash
npm run docker:down
```

## End-to-End Tests

```bash
npm run test:e2e
```

## Monitoring

- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001
- Prometheus scrape endpoint: `GET /metrics`
- JSON metrics endpoint: `GET /api/metrics`

Core metrics exported:

- `queue_depth`
- `queue_lag`
- `worker_throughput_completed`
- `worker_throughput_failed`
- `queue_success_rate`
- `queue_failure_rate`
- `redis_memory_usage`
- `api_latency`

## S3/CDN Behavior

- Logos are written under `trade-replay/logos/`.
- Portfolio files are written under `trade-replay/portfolios/`.
- When `AWS_CDN_BASE_URL` is configured, logo URLs are returned using the CDN base URL.
- When `AWS_CDN_BASE_URL` is empty, logo URLs fall back to direct S3 object URLs.

## CI/CD (Jenkins)

Pipeline stages in Jenkinsfile:

1. Checkout
2. Install dependencies
3. Build backend/frontend/logo-service
4. Docker compose build
5. Deploy stack
6. Post-deploy validation (`npm run validate`)

## Folder Structure

```text
backend/
	src/
		controllers/
		services/
		models/
		jobs/
		kafka/
		utils/
		config/
		middlewares/

frontend/
	components/
	services/
	utils/
	config/

services/
	logo-service/

tests/
	unit/
	integration/
	load/
```

## Scaling Roadmap

- Short term: isolate API, worker/logo-service, and stateful infra (Redis/Kafka/Mongo) onto separate nodes.
- Medium term: move workers to horizontal autoscaling consumers and orchestrate with Kubernetes.
- Long term: managed DB cluster, dedicated Kafka/Redis, edge caching, global load balancing.

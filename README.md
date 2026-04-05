# tradereplay

Production-ready monorepo for Trade Replay.

Domain provider: Namecheap

## Final Structure

tradereplay/
- frontend/
- backend/
- e2e/
- docker-compose.yml
- package.json
- README.md
- .env

## Tech Stack

- Frontend: React + Vite + Tailwind → Vercel
- Backend: Node.js + TypeScript + Express (MVC) → DO $6 Droplet
- Database: MongoDB Atlas (FREE M0 cluster)
- Cache: Redis (local on droplet, 100MB)
- Event Streaming: Apache Kafka KRaft (local on droplet, 128MB heap)
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

## Auth Flow

1. Client authenticates via /api/auth/login or /api/auth/register.
2. Backend returns a signed JWT.
3. Client sends Authorization: Bearer <token>.
4. backend/src/middlewares/verifyToken.ts validates JWT and attaches req.user.
5. Protected routes return 401 for missing/invalid token.

## Environment

Use one root `.env` only, with profile prefixes:

- `LOCAL_`
- `DEV_`
- `QA_`
- `PROD_`

Examples:

- `LOCAL_MONGO_URI`
- `DEV_JWT_SECRET`
- `QA_GOOGLE_CLIENT_ID`
- `PROD_VITE_API_URL`

### Kafka Environment Variables

| Variable | Description | Default |
|---|---|---|
| `KAFKA_ENABLED` | Enable Kafka producer/consumers | `false` |
| `KAFKA_BROKERS` | Comma-separated broker list | `localhost:9092` |
| `KAFKA_SASL_USERNAME` | SASL username (Confluent Cloud) | _(empty)_ |
| `KAFKA_SASL_PASSWORD` | SASL password (Confluent Cloud) | _(empty)_ |
| `KAFKA_SASL_MECHANISM` | SASL mechanism | `plain` |

The app resolves profile values from `NODE_ENV` and falls back to `LOCAL_` values.

Google OAuth client ID must be set via environment variable `VITE_GOOGLE_CLIENT_ID` in `.env`.

## Product Flow

Required user journey is now:

1. Login / signup
2. Open dashboard
3. Create or import a saved portfolio
4. Pick scenario per portfolio
5. Launch simulation and trade

## Production Hardening

### Kafka Event Architecture

Topics:

- `trades.execute` — Trade execution requests
- `trades.result` — Trade results with P&L
- `portfolio.update` — Portfolio change events
- `simulation.events` — Simulation lifecycle (init/play/pause)
- `user.activity` — Login/register/session events

Consumers:

- **Trade Processor** — Caches latest trade in Redis, logs analytics
- **Portfolio Updater** — Invalidates portfolio cache on changes
- **Analytics Processor** — DAU tracking (HyperLogLog), action counters, top symbols (sorted set)

Features:

- Non-blocking fire-and-forget producers (microtask queue)
- Batch consumption with heartbeats
- Idempotency via eventId deduplication
- Snappy compression
- Graceful degradation (app works without Kafka)
- Graceful shutdown with SIGINT/SIGTERM

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

## Docker (Backend + MongoDB + Redis)

```bash
npm run docker:up
```

Compose services:

- backend
- mongodb
- redis
- kafka (KRaft, no Zookeeper)

To stop:

```bash
npm run docker:down
```

## End-to-End Tests

```bash
npm run test:e2e
```

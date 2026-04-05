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

The app resolves profile values from `NODE_ENV` and falls back to `LOCAL_` values.

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

## Docker (Backend + MongoDB + Redis)

```bash
npm run docker:up
```

Compose services:

- backend
- mongodb
- redis

To stop:

```bash
npm run docker:down
```

## End-to-End Tests

```bash
npm run test:e2e
```

# Trade Replay

A full-stack trading simulation and portfolio management platform with a custom chart library, live screener, drawing tools, strategy backtesting, and real-time data feeds.

**Production URL:** https://tradereplay.me | https://api.tradereplay.me  
**GitHub:** https://github.com/Jatin-cheti/trade-replay  
**Domain:** Namecheap

---

## What We Are Building

Trade Replay is a platform where traders can:

- **Replay historical market data** — simulate trading on past price action bar by bar, making buy/sell decisions in real time without knowing the future
- **Paper trade** — practice strategies with virtual portfolios
- **Screener** — filter thousands of stocks, ETFs, crypto, forex, futures by technical and fundamental criteria
- **Custom charts** — a full chart library (`@tradereplay/charts`) that mirrors the TradingView/lightweight-charts API surface so users can embed our charts, drawing tools, and indicators in their own applications
- **Drawing tools** — 35+ TradingView-parity drawing tools (trend lines, Fibonacci, Gann, channels, pitchforks, etc.) usable programmatically via the chart library API
- **150+ indicators** — SMAs, EMAs, RSI, MACD, Bollinger Bands, Ichimoku, advanced MAs (HMA, DEMA, TEMA, ZLEMA, KAMA, ALMA), oscillators (StochRSI, RVI, PPO, TSI, Fisher, KDJ), volume indicators (ADL, Force Index, VWAP), and 54 extra TradingView indicators (batch5)
- **22 strategy signals** — Bollinger Bands, MACD, Supertrend, Ichimoku, ADX, Keltner Channel, and more
- **Portfolio analytics** — performance tracking, P&L, drawdown, trade history

---

## Current Status

### ON PRODUCTION (live at tradereplay.me)

| Feature | Status |
|---|---|
| Backend API (Express + MongoDB) | Live |
| Frontend (React + Vite) | Live |
| Screener — stocks, ETFs, crypto, forex, futures | Live |
| Instant symbol search (trie-based, ~10ms) | Live |
| Chart service (OHLCV fetch + multi-symbol batch) | Live |
| Logo service + S3/CDN | Live |
| Authentication (JWT + Google OAuth) | Live |
| Portfolio tracking | Live |
| Real-time price feed (WebSocket) | Live |
| Kafka event streaming | Live |
| Redis caching + BullMQ queues | Live |
| 150+ technical indicators | Live (in library) |
| 35 drawing tools | Live (in library) |
| PM2 process management (Droplet A + B) | Live |

### NOT YET ON PRODUCTION

| Feature | Status |
|---|---|
| Trade replay / bar-by-bar simulation mode | Built, not fully wired to UI |
| Strategy backtesting with signal overlay | Built in library, UI incomplete |
| `@tradereplay/charts` npm package (public) | Internal use only, not published |
| Alert service (price alerts, notifications) | Built, PM2 `waiting` — needs `pm2 start` on Droplet A |
| Screener chart sparklines from chart-service | Partially live (fallback candles if service down) |
| TradingView parity e2e test suite | Built, not in CI |
| Multi-timeframe charts | Stub only |
| Social features (sharing, leaderboard) | Not started |

---

## Architecture

### Monorepo Structure

```
tradereplay/
├── backend/                    # Express API server (Node.js + TypeScript)
│   ├── src/
│   │   ├── controllers/        # Route handlers
│   │   ├── models/             # Mongoose schemas (CleanAsset, Portfolio, User, Trade…)
│   │   ├── routes/             # Express routers
│   │   ├── services/           # Business logic, screener, trie search, caching
│   │   ├── jobs/               # Symbol ingestion, logo sweep, coverage loop
│   │   └── migrations/         # DB schema migrations
│   └── package.json
│
├── frontend/                   # React 18 + Vite + TypeScript
│   ├── src/
│   │   ├── components/         # UI components
│   │   │   └── chart/          # TradingChart.tsx — main chart container (5800+ lines)
│   │   ├── lib/
│   │   │   └── chartLibraryAPI.ts   # Singleton bridge to @tradereplay/charts
│   │   ├── pages/              # Route pages (screener, portfolio, replay, etc.)
│   │   └── hooks/              # Custom React hooks
│   └── package.json
│
├── packages/
│   └── tradereplay-charts/     # @tradereplay/charts — the custom chart library
│       └── src/
│           ├── drawing/        # Drawing engine + 35 tools
│           │   ├── engine/     # DrawingEngine state machine, keyboard, modal handlers
│           │   └── tools/      # 35 IDrawingTool implementations
│           ├── indicators/
│           │   └── builtins/   # 150+ indicator compute functions + IndicatorDefinition
│           ├── transforms/     # Data transforms (OHLCV normalisation, timestamp)
│           └── lib/            # ChartLibraryAPI, renderer, interaction manager
│
├── services/
│   ├── chart-service/          # Standalone chart data microservice (OHLCV + multi-batch)
│   ├── logo-service/           # Logo fetch, resize, S3 upload worker
│   ├── alert-service/          # Price alert processor
│   ├── asset-service/          # Asset metadata enrichment
│   ├── screener-service/       # Screener query engine (alternate)
│   └── shared/                 # Shared types and utilities across services
│
├── deploy/                     # Deployment scripts and configs
│   ├── deploy-two-droplet.sh   # Main deploy script (SSH → both droplets)
│   ├── ecosystem.config.droplet-a.cjs   # PM2 config for Droplet A (app server)
│   ├── ecosystem.config.droplet-b.cjs   # PM2 config for Droplet B (infra services)
│   ├── nginx/                  # Nginx site configs
│   └── env/                    # Environment variable templates (secrets gitignored)
│
├── e2e/                        # Playwright end-to-end tests
│   ├── factories/              # TV-parity test factories
│   ├── scripts/                # PowerShell baseline capture scripts
│   └── output/                 # Generated test results (gitignored)
│
├── docs/                       # Project documentation
│   ├── architecture/           # System design docs
│   ├── deployment/             # Deployment security checklist
│   └── features/               # Feature specs and improvement reports
│
├── tests/                      # Integration and load tests
├── scripts/                    # Dev utility scripts
├── docker-compose.yml          # Local dev infrastructure (MongoDB, Redis, Kafka)
└── Jenkinsfile                 # Jenkins pipeline (Docker build → docker compose up)
```

---

## Production Infrastructure

### Two-Droplet DigitalOcean Architecture

**Droplet A** — `64.227.184.166` — App server (public-facing)
- Nginx (reverse proxy, SSL termination via Let's Encrypt)
- PM2 processes: `backend`, `frontend` (built static via Vite), `chart-service`, `logo-service`, `kafka-service`, `alert-service`
- All processes run `npm ci --omit=dev` — no devDependencies installed

**Droplet B** — `159.89.163.155` — Infrastructure server (private network only)
- PM2 processes: `mongodb`, `redis`, `kafka` (KRaft mode, no Zookeeper), `worker`
- Accessible only from Droplet A via private DigitalOcean network
- No public ports exposed

**Private Network:** Droplet A → Droplet B via `10.x.x.x` DigitalOcean private IP

### Deployment Flow

```bash
# From your local machine (SSH key required):
bash deploy/deploy-two-droplet.sh

# What it does:
# 1. git push origin main
# 2. SSH into Droplet A: git pull, npm ci --omit=dev, pm2 startOrReload, pm2 save
# 3. SSH into Droplet B: git pull, npm ci --omit=dev, pm2 startOrReload, pm2 save
```

**CI/CD:** GitHub Actions runs on every push to `main`:
- Unit tests
- Security scan (gitleaks — blocks commits with secrets)
- Frontend build check
- HTTP smoke test against production URLs

**Jenkins** (`Jenkinsfile`): Docker-based deployment pipeline — builds images and runs `docker compose up` for a containerised stack. Currently used as an alternative/fallback; primary production uses PM2 directly.

### Environment Variables

Never commit secrets. Required vars:
- `MONGO_URI` — MongoDB connection (Droplet B private IP)
- `REDIS_URL` — Redis connection (Droplet B private IP)
- `JWT_SECRET` — JWT signing secret
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `S3_BUCKET` — logo CDN
- `KAFKA_BROKERS` — Kafka bootstrap servers

Template: `deploy/env/.env.example` (never commit `.env.secrets*` or `.env.*`)

---

## The Chart Library (`@tradereplay/charts`)

The library exposes a TradingView-compatible API surface so users can create charts, add indicators, attach drawing tools, and react to events — identically to how they would use TradingView's lightweight-charts.

### Key Interfaces

```typescript
// Create a chart
const chart = ChartLibraryAPI.create({ container: el, width: 800, height: 600 });

// Add a candlestick series
const series = chart.addCandlestickSeries();
series.setData(ohlcvData);

// Add an indicator
chart.addIndicator('rsi', { period: 14 });

// Add a drawing tool
chart.setDrawingTool('trendLine');

// Listen for events
chart.on('drawingCreated', (drawing) => { ... });
```

### Drawing Engine State Machine

```
IDLE → STARTED → PREVIEW → COMPLETED → SELECTED → EDITING
```

The `DrawingEngine` class manages all drawing state. Every tool implements `IDrawingTool`:
- `render(ctx, drawing, viewport)` — canvas rendering
- `hitTest(drawing, screenPoint, viewport)` — click/hover detection
- `getHandles(drawing, viewport)` — drag anchor descriptors
- `createDraft(point)` / `updateDraft(point)` / `finalize()` — creation flow

### 35 Drawing Tools (all TradingView-parity)

Lines: TrendLine, ExtendedLine, RayLine, HorizontalLine, HorizontalRay, VerticalLine, CrossLine, InfoLine, TrendAngle  
Channels: ParallelChannel, DisjointChannel, RegressionTrend  
Fibonacci: FibRetracement, FibExtension, FibChannel, FibSpeedResistFan, FibSpeedResistArcs, FibTimeZone, FibTrendTime, FibWedge, FibSpiral, FibCircles  
Gann: GannBox, GannFan, GannSquare, GannSquareFixed  
Patterns: FlatTopBottom, Pitchfork, Pitchfan, SineLine, Rectangle, PatternTools

### 150+ Technical Indicators

**Moving Averages:** SMA, EMA, WMA, DEMA, TEMA, HMA, ZLEMA, KAMA, ALMA, LSMA  
**Oscillators:** RSI, MACD, Stochastic, CCI, Awesome, Williams %R, ROC, Momentum, DPO, TRIX, Ultimate, CMF, MFI, OBV, ADX, Aroon, Supertrend  
**Bands/Channels:** Bollinger Bands, Keltner, Donchian, VWAP, Ichimoku  
**Advanced Oscillators (batch2):** StochRSI, RVI, PPO, PVO, TSI, DX, CRSI, ElderRay, CMO, Fisher, KDJ, AroonOscillator  
**Volume/Stats (batch2):** Bollinger %B, Bollinger Bandwidth, ChaikinVolatility, ADL, ForceIndex, EOM, NVI, PVI, VPT, Vortex, Stddev, Variance  
**Batch5 (TradingView extras):** BBTrend, ChandeKrollStop, ChandelierExit, LinearRegChannel, MACross, MAribbon, McGinleyDynamic, KlingerOsc, KnowSureThing, TWAP, VWMA, VWAPAutoAnchored, WoodiesCCI, ZigZag, AutoFibRetracement, AutoFibExtension, AutoPitchfork, AutoTrendlines, PivotHighLow, RobBooker suite, SMIErgodic, RCIRibbon, RelativeVolatilityIndex, PriceMomentumOsc, PringsSpecialK, and more

**22 Strategy Signals:** Bollinger, ChannelBreakout, MACD, MACross, RSI, Stochastic, Supertrend, Ichimoku, Aroon, ParabolicSAR, ATRTrailing, PivotReversal, MeanReversion, Momentum, WilliamsR, CCI, ADX, KeltnerChannel, Donchian, EMACross, InsideBar, VolumeBreakout

---

## Local Development

### Prerequisites

- Node.js 20+
- Docker + Docker Compose (for local MongoDB, Redis, Kafka)

### Setup

```bash
git clone https://github.com/Jatin-cheti/trade-replay.git
cd trade-replay/tradereplay

# Copy environment template
cp deploy/env/.env.example .env
# Fill in your local values in .env

# Install all dependencies
npm run install:all

# Start local infrastructure (MongoDB, Redis, Kafka via Docker)
npm run dev:infra

# Run the full stack
npm run app:full
```

The `app:full` script runs concurrently:
- `backend` on port 3000
- `chart-service` on port 3001
- `logo-service`
- `kafka-service` (consumer)
- `worker` (BullMQ)
- `frontend` on port 5173

### Running Individual Services

```bash
# Backend only
cd backend && npm run dev

# Frontend only
cd frontend && npm run dev

# Chart service only
cd services/chart-service && npm run dev

# Seed the database
npm run seed
```

---

## Code Structure Rules

- **No file over 500 lines.** Large files are split into category files with a barrel re-export.
- **No duplicate utility functions.** Shared helpers live in `_helpers.ts` or dedicated service files.
- **Never commit secrets.** `.env`, `.env.*`, `*.pem`, `*.key`, `deploy/env/.env.secrets*` are all gitignored.
- **Run gitleaks before pushing.** CI blocks pushes if secrets are detected.
- **TypeScript strict mode** throughout. No `any` except at system boundaries.

### File Split Conventions (indicators)

| File | Contents |
|---|---|
| `batch2-ma.ts` | DEMA, TEMA, HMA, ZLEMA, KAMA, ALMA, LSMA compute + defs |
| `batch2-oscillators.ts` | StochRSI, RVI, PPO, PVO, TSI, DX, CRSI, ElderRay, CMO, Fisher, KDJ, AroonOsc |
| `batch2-volume.ts` | Bollinger %B/BW, ChaikinVol, ADL, ForceIndex, EOM, NVI, PVI, VPT, Vortex, Stddev, Variance |
| `batch2.ts` | Barrel: `export * from './batch2-ma.ts'` etc. |
| `batch5-trend.ts` | AutoFib, AutoPitchfork, BBTrend, ChandeKroll, Chandelier, LinearRegChannel, MACross, maRibbon, McGinley, PivotHighLow, RobBooker, VolatilityStop, ZigZag |
| `batch5-oscillators.ts` | ADR, AdvDecline, BollingerBars, ChopZone, Correlation, Klinger, KST, Performance, PMO, PringsSpecialK, RCI, RVI, RobBookerKnoxville/Reversal, RSIDivergence, SMIErgodic, WoodiesCCI |
| `batch5-volume.ts` | Volume24h, CVI, NetVolume, TWAP, TradingSessions, VAP, Volume, VolumeDelta, VWMA, VWAPAutoAnchored, stubs |
| `batch5.ts` | Barrel |
| `strategies-part1.ts` | BB, ChannelBreakout, MACD, MACross, RSI, Stochastic, Supertrend, Ichimoku, Aroon, PSAR, ATRTrailing |
| `strategies-part2.ts` | PivotReversal, MeanReversion, Momentum, WilliamsR, CCI, ADX, Keltner, Donchian, EMACross, InsideBar, VolumeBreakout |
| `strategies.ts` | Assembles `allStrategies` from both parts |

---

## Testing

### E2E Parity Tests (Playwright)

Tests compare our chart library output against TradingView screenshots pixel by pixel.

```bash
# Capture reference screenshots from TradingView (run once)
cd e2e && npx playwright test tv-capture

# Run parity tests
npx playwright test tv-parity

# Results in e2e/output/ (gitignored)
```

### Integration Tests

```bash
npm run validate          # Full system validation
npm run validate:symbols  # Symbol data integrity
```

---

## Security

- All secrets in `.env` / `deploy/env/.env.secrets*` — never committed
- Gitleaks runs in CI on every push
- JWT tokens with configurable expiry
- Rate limiting on all public API endpoints
- Helmet.js security headers
- SSH key auth only for production servers (no password auth)
- Nginx SSL with Let's Encrypt (auto-renew)

---

## What's Next

1. **Wire replay simulation to UI** — bar-by-bar playback mode with controls
2. **Publish `@tradereplay/charts`** — as an npm package for external devs
3. **Alert service** — start the PM2 process on Droplet A (`pm2 start alert-service`)
4. **More drawing tool parity** — complete remaining TV tool tests from e2e suite
5. **Strategy backtester UI** — show signal overlay on historical chart with P&L stats
6. **Split `TradingChart.tsx`** — 5800-line file needs decomposition into hooks and subcomponents
7. **Social features** — portfolio sharing, leaderboard, trade journaling

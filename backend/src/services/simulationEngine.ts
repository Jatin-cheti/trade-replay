import { Server } from "socket.io";
import { CandleData, ScenarioId } from "../types/shared";
import { SimulationSessionState } from "../types/service";
import { logger } from "../utils/logger";

export class SimulationEngine {
  private sessions = new Map<string, SimulationSessionState>();
  private pendingCandleUpdates = new Map<string, unknown>();
  private pendingPortfolioUpdates = new Map<string, unknown>();
  private pendingTradeUpdates = new Map<string, unknown>();
  private flushTimer: NodeJS.Timeout;

  constructor(private io: Server) {
    this.flushTimer = setInterval(() => this.flushPendingEvents(), 500);
    this.flushTimer.unref();
  }

  upsertSession(input: {
    userId: string;
    scenarioId: ScenarioId;
    symbol: string;
    candles: CandleData[];
    currentIndex?: number;
  }): SimulationSessionState {
    const previous = this.sessions.get(input.userId);
    if (previous?.timer) {
      clearInterval(previous.timer);
    }

    const session: SimulationSessionState = {
      userId: input.userId,
      scenarioId: input.scenarioId,
      symbol: input.symbol,
      candles: input.candles,
      currentIndex: input.currentIndex ?? 0,
      isPlaying: false,
      playSpeed: 1,
      timer: null,
    };

    this.sessions.set(input.userId, session);
    logger.info("simulation_session_upserted", {
      userId: input.userId,
      scenarioId: input.scenarioId,
      symbol: input.symbol,
      candleCount: input.candles.length,
    });
    this.emitCandle(input.userId);
    return session;
  }

  getSession(userId: string): SimulationSessionState | undefined {
    return this.sessions.get(userId);
  }

  setIndex(userId: string, index: number): SimulationSessionState | undefined {
    const session = this.sessions.get(userId);
    if (!session) return undefined;

    session.currentIndex = Math.max(0, Math.min(index, session.candles.length - 1));
    this.emitCandle(userId);
    return session;
  }

  step(userId: string, delta: 1 | -1): SimulationSessionState | undefined {
    const session = this.sessions.get(userId);
    if (!session) return undefined;

    session.currentIndex = Math.max(0, Math.min(session.currentIndex + delta, session.candles.length - 1));
    this.emitCandle(userId);
    return session;
  }

  play(userId: string, speed: number): SimulationSessionState | undefined {
    const session = this.sessions.get(userId);
    if (!session) return undefined;

    session.playSpeed = speed;
    session.isPlaying = true;
    logger.info("simulation_play", { userId, speed });
    if (session.timer) {
      clearInterval(session.timer);
    }

    session.timer = setInterval(() => {
      if (session.currentIndex >= session.candles.length - 1) {
        this.pause(userId);
        return;
      }
      session.currentIndex += 1;
      this.emitCandle(userId);
    }, Math.max(1000 / Math.max(speed, 0.5), 100));

    return session;
  }

  pause(userId: string): SimulationSessionState | undefined {
    const session = this.sessions.get(userId);
    if (!session) return undefined;

    session.isPlaying = false;
    logger.info("simulation_pause", { userId, index: session.currentIndex });
    if (session.timer) {
      clearInterval(session.timer);
      session.timer = null;
    }

    return session;
  }

  emitPortfolio(userId: string, payload: unknown): void {
    this.pendingPortfolioUpdates.set(userId, payload);
  }

  emitTrade(userId: string, payload: unknown): void {
    this.pendingTradeUpdates.set(userId, payload);
  }

  private emitCandle(userId: string): void {
    const session = this.sessions.get(userId);
    if (!session) return;

    const candle = session.candles[session.currentIndex] ?? null;
    this.pendingCandleUpdates.set(userId, {
      scenarioId: session.scenarioId,
      symbol: session.symbol,
      currentIndex: session.currentIndex,
      totalCandles: session.candles.length,
      candle,
      isPlaying: session.isPlaying,
      playSpeed: session.playSpeed,
    });
  }

  private flushPendingEvents(): void {
    this.pendingCandleUpdates.forEach((payload, userId) => {
      this.io.to(userId).emit("candle:update", payload);


    });

    this.pendingPortfolioUpdates.forEach((payload, userId) => {
      this.io.to(userId).emit("portfolio:update", payload);
    });

    this.pendingTradeUpdates.forEach((payload, userId) => {
      this.io.to(userId).emit("trade:executed", payload);
    });

    this.pendingCandleUpdates.clear();
    this.pendingPortfolioUpdates.clear();
    this.pendingTradeUpdates.clear();
  }
}

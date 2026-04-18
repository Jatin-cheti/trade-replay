import { CandleData, ScenarioId } from "./shared";

export interface InitPayload {
  scenarioId: ScenarioId;
  symbol: string;
  startDate?: string;
  endDate?: string;
  portfolioId?: string;
  dataMode?: "default" | "parity-live";
}

export interface TradeInput {
  type: "BUY" | "SELL";
  quantity: number;
}

export interface AlphaDailyResponse {
  "Time Series (Daily)"?: Record<string, {
    "1. open": string;
    "2. high": string;
    "3. low": string;
    "4. close": string;
    "5. volume": string;
  }>;
  Note?: string;
  Information?: string;
  "Error Message"?: string;
}

export interface FallbackFile {
  scenarioId: ScenarioId;
  generatedAt: string;
  candlesBySymbol: Record<string, CandleData[]>;
}

export interface SimulationSessionState {
  userId: string;
  scenarioId: ScenarioId;
  symbol: string;
  candles: CandleData[];
  currentIndex: number;
  isPlaying: boolean;
  playSpeed: number;
  timer: NodeJS.Timeout | null;
}

export interface MigrationRecord {
  id: string;
  ranAt: Date;
}

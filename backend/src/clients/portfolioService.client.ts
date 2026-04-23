import axios from "axios";
import { env } from "../config/env";
import { AppError } from "../utils/appError";

const portfolioServiceHttp = axios.create({
  baseURL: env.PORTFOLIO_SERVICE_URL,
  timeout: 4000,
});

function toServiceError(error: unknown, fallbackCode: string, fallbackMessage: string): never {
  if (axios.isAxiosError(error)) {
    const statusCode = error.response?.status ?? 503;
    const serviceMessage = typeof error.response?.data?.message === "string"
      ? error.response.data.message
      : fallbackMessage;
    const serviceCode = typeof error.response?.data?.code === "string"
      ? error.response.data.code
      : fallbackCode;
    throw new AppError(statusCode, serviceCode, serviceMessage);
  }

  throw new AppError(503, fallbackCode, fallbackMessage);
}

function userHeaders(userId: string): Record<string, string> {
  return {
    "x-user-id": userId,
  };
}

export async function getPortfolioServicePortfolio(userId: string) {
  try {
    const response = await portfolioServiceHttp.get("/portfolio", { headers: userHeaders(userId) });
    return response.data;
  } catch (error) {
    toServiceError(error, "PORTFOLIO_SERVICE_PORTFOLIO_FAILED", "Portfolio service unavailable");
  }
}

export async function getPortfolioServicePositions(userId: string, status?: string) {
  try {
    const response = await portfolioServiceHttp.get("/positions", {
      headers: userHeaders(userId),
      params: status ? { status } : undefined,
    });
    return response.data;
  } catch (error) {
    toServiceError(error, "PORTFOLIO_SERVICE_POSITIONS_FAILED", "Portfolio positions unavailable");
  }
}

export async function getPortfolioServicePnl(userId: string) {
  try {
    const response = await portfolioServiceHttp.get("/pnl", { headers: userHeaders(userId) });
    if (
      response.data &&
      typeof response.data === "object" &&
      "pnl" in response.data &&
      response.data.pnl &&
      typeof response.data.pnl === "object"
    ) {
      return response.data.pnl;
    }

    return response.data;
  } catch (error) {
    toServiceError(error, "PORTFOLIO_SERVICE_PNL_FAILED", "Portfolio PnL unavailable");
  }
}

export async function getPortfolioServiceTrades(userId: string) {
  try {
    const response = await portfolioServiceHttp.get("/trades", { headers: userHeaders(userId) });
    return response.data;
  } catch (error) {
    toServiceError(error, "PORTFOLIO_SERVICE_TRADES_FAILED", "Portfolio trade history unavailable");
  }
}

export async function postPortfolioServiceTrade(input: {
  userId: string;
  symbol: string;
  type: "BUY" | "SELL";
  quantity: number;
  price: number;
}) {
  try {
    const response = await portfolioServiceHttp.post("/trade", input);
    return response.data;
  } catch (error) {
    toServiceError(error, "PORTFOLIO_SERVICE_TRADE_FAILED", "Portfolio trade failed");
  }
}
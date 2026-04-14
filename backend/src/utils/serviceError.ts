import { AppError } from "./appError";

const serviceCodeMap: Record<string, { statusCode: number; message: string }> = {
  NO_CANDLES: { statusCode: 404, message: "No candle data available" },
  SIM_NOT_INITIALIZED: { statusCode: 400, message: "Simulation not initialized" },
  NO_CANDLE: { statusCode: 400, message: "Current candle unavailable" },
  NO_PORTFOLIO: { statusCode: 404, message: "Portfolio not found" },
  INSUFFICIENT_BALANCE: { statusCode: 400, message: "Insufficient balance" },
  INSUFFICIENT_HOLDINGS: { statusCode: 400, message: "Insufficient holdings" },
  EMAIL_EXISTS: { statusCode: 409, message: "Email already exists" },
  INVALID_CREDENTIALS: { statusCode: 401, message: "Invalid credentials" },
  MISSING_GOOGLE_EMAIL: { statusCode: 400, message: "Google email is required" },
  GOOGLE_CLIENT_ID_NOT_CONFIGURED: { statusCode: 503, message: "Google login is temporarily unavailable" },
  MISSING_GOOGLE_ID_TOKEN: { statusCode: 400, message: "Google ID token is required" },
  GOOGLE_CLIENT_ID_EMPTY: { statusCode: 503, message: "Google login is temporarily unavailable" },
  INVALID_GOOGLE_TOKEN_FORMAT: { statusCode: 400, message: "Invalid Google token format" },
  INVALID_GOOGLE_TOKEN_PAYLOAD: { statusCode: 400, message: "Could not decode Google token" },
};

export function mapServiceError(error: unknown, fallbackCode: string, fallbackMessage: string): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    const mapped = serviceCodeMap[error.message];
    if (mapped) {
      return new AppError(mapped.statusCode, error.message, mapped.message);
    }
  }

  return new AppError(500, fallbackCode, fallbackMessage);
}

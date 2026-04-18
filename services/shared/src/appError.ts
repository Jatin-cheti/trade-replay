export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toAppError(error: unknown, fallbackMessage: string, fallbackCode = "INTERNAL_ERROR"): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof Error) return new AppError(500, fallbackCode, error.message || fallbackMessage);
  return new AppError(500, fallbackCode, fallbackMessage);
}

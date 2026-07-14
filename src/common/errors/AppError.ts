export interface AppErrorOptions {
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details: Record<string, unknown> | undefined;

  public constructor(message: string, options: AppErrorOptions = {}) {
    super(message, { cause: options.cause });

    this.name = "AppError";
    this.code = options.code ?? "APP_ERROR";
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
  }
}

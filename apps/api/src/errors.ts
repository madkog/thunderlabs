/**
 * An error with an HTTP status and a stable code the client can check.
 * Thrown anywhere in a request; the error handler turns it into
 * { error: { code, message, details? } }.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

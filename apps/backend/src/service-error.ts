type ServiceErrorCode =
  | "NotFound"
  | "InvalidInput"
  | "Forbidden"
  | "Conflict"
  | "InternalError"
  | string;

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    detail?: unknown
  ) {
    super(`Service error: ${code}${detail ? ` - ${detail}` : ""}`);
    this.name = "ServiceError";
  }
}

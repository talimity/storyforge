type ServiceErrorCode =
  | "NotFound"
  | "InvalidInput"
  | "Forbidden"
  | "Conflict"
  | "InternalError";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    ctx?: { message?: string } & Record<string, unknown>
  ) {
    super(`Service error: ${code}${ctx ? ` - ${ctx.message || ""}` : ""}`);
    this.name = "ServiceError";
  }
}

import { TRPCError } from "@trpc/server";
import type { ServiceError } from "@/service-error";

/**
 * Maps an ServiceError to a TRPCError.
 */
export function serviceErrorToTRPC(e: ServiceError): never {
  const { code, message } = e;
  const cause = e;
  switch (code) {
    case "NotFound": {
      throw new TRPCError({
        code: "NOT_FOUND",
        cause,
        message: message || "Resource not found.",
      });
    }
    case "InvalidInput": {
      throw new TRPCError({
        code: "BAD_REQUEST",
        cause,
        message: message || "Invalid input provided.",
      });
    }
    case "Forbidden": {
      throw new TRPCError({
        code: "FORBIDDEN",
        cause,
        message:
          message || "You do not have permission to perform this action.",
      });
    }
    case "Conflict": {
      throw new TRPCError({
        code: "CONFLICT",
        cause,
        message: message || "Conflict with existing resource.",
      });
    }
    case "InternalError": {
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        cause,
        message: message || "An internal error occurred.",
      });
    }
    default: {
      const unmappedError = code satisfies never;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        cause,
        message: `Unexpected error: ${unmappedError}`,
      });
    }
  }
}

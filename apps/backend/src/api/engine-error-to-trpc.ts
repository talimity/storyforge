import { TRPCError } from "@trpc/server";
import type { EngineError } from "../engine-error.js";

/**
 * Maps an EngineError to a TRPCError.
 * This function is used to convert the result of an operation into a TRPCError
 * if the operation failed.
 */
export function engineErrorToTRPC(e: EngineError): never {
  switch (e.code) {
    // common
    case "LoadFailed":
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load required data.",
      });
    // turn invariants
    case "ParticipantNotFound":
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Turn author participant not found.",
      });
    case "ParticipantInactive":
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Turn author is inactive.",
      });
    case "CrossScenarioAuthor":
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Turn author belongs to another scenario.",
      });
    case "CannotPromoteMultipleToRoot":
      throw new TRPCError({
        code: "CONFLICT",
        message: "Cannot promote multiple turns to root.",
      });
    // turn progression invariants
    case "ParentTurnNotFound":
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Parent turn not found.",
      });
    case "ChapterNotFound":
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Chapter not found.",
      });
    case "ChapterScenarioMismatch":
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Chapter does not belong to the scenario.",
      });
    case "ParentTurnScenarioMismatch":
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Parent turn does not belong to the scenario.",
      });
    case "ChapterProgressionInvalid":
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          "Turn cannot be appended to the chapter because it would be out of sequence.",
      });
    // turn content invariants
    case "MissingPresentationLayer":
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Turn content must include a presentation layer.",
      });
    case "DuplicateLayerKey":
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Turn content cannot have duplicate layer keys.",
      });
    default: {
      const unmappedError = e.code satisfies never;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: `Unexpected error: ${unmappedError}`,
      });
    }
  }
}

import { err, ok, type Result } from "@storyforge/utils";

export type TurnChapterErr =
  | "LoadFailed"
  | "ParentTurnNotFound"
  | "ChapterNotFound"
  | "ChapterScenarioMismatch"
  | "ParentTurnScenarioMismatch"
  | "ChapterAlreadyStarted"
  | "ChapterProgressionInvalid";

type ChapterLite = {
  id: string;
  scenarioId: string;
  index: number;
  firstTurnId: string | null;
};

type TurnLite = {
  id: string;
  chapterId: string;
  scenarioId: string;
};

type ChapterLoaders = {
  loadChapter: (chapterId: string) => Promise<ChapterLite | undefined>;
  loadTurn: (turnId: string) => Promise<TurnLite | undefined>;
};

/**
 * Validate whether a turn can be appended to a chapter in the scenario.
 * This checks the chapter's existence, scenario association, and whether the
 * turn can be appended as a root or under an existing parent turn.
 */
export async function canAppendTurnToChapter(args: {
  scenarioId: string;
  targetChapterId: string;
  parentTurnId: string | null;
  loaders: ChapterLoaders;
}): Promise<Result<void, TurnChapterErr>> {
  const { scenarioId, targetChapterId, parentTurnId, loaders } = args;

  try {
    const targetChapter = await loaders.loadChapter(targetChapterId);

    // Target chapter must exist
    if (!targetChapter) {
      return err("ChapterNotFound");
    }

    // Target chapter must belong to the scenario
    if (targetChapter.scenarioId !== scenarioId) {
      return err("ChapterScenarioMismatch");
    }

    // Branch based on whether we have a parent turn
    if (parentTurnId === null) {
      // Root insertion case: creating the first turn in a timeline
      return validateRootInsertion(targetChapter);
    } else {
      // Normal append/branch case: adding to existing timeline
      return await validateNormalAppend({
        parentTurnId,
        targetChapter,
        scenarioId,
        loaders,
      });
    }
  } catch {
    return err("LoadFailed");
  }
}

/**
 * Validate rules for inserting a root turn, which is the first turn in the
 * scenario.
 */
function validateRootInsertion(
  targetChapter: ChapterLite
): Result<void, TurnChapterErr> {
  // Root turns can only be created in chapter 0
  if (targetChapter.index !== 0) {
    return err("ChapterProgressionInvalid");
  }

  // Chapter shouldn't already have a first turn
  if (targetChapter.firstTurnId !== null) {
    return err("ChapterAlreadyStarted");
  }

  return ok(undefined);
}

/**
 * Validate rules for appending a turn to the scenario under an existing turn.
 */
async function validateNormalAppend(args: {
  parentTurnId: string;
  targetChapter: ChapterLite;
  scenarioId: string;
  loaders: ChapterLoaders;
}): Promise<Result<void, TurnChapterErr>> {
  const { parentTurnId, targetChapter, scenarioId, loaders } = args;

  try {
    const parentTurn = await loaders.loadTurn(parentTurnId);

    // Parent turn must exist when ID was provided
    if (!parentTurn) {
      return err("ParentTurnNotFound");
    }

    // Parent turn must belong to the same scenario
    if (parentTurn.scenarioId !== scenarioId) {
      return err("ParentTurnScenarioMismatch");
    }

    // Now validate chapter progression
    return await validateChapterProgression({
      parentTurn,
      targetChapter,
      loaders,
    });
  } catch {
    return err("LoadFailed");
  }
}

/**
 * Validate the chapter progression rules based on the parent turn and target
 * chapter.
 */
async function validateChapterProgression(args: {
  parentTurn: TurnLite;
  targetChapter: ChapterLite;
  loaders: ChapterLoaders;
}): Promise<Result<void, TurnChapterErr>> {
  const { parentTurn, targetChapter, loaders } = args;

  try {
    const parentChapter = await loaders.loadChapter(parentTurn.chapterId);

    if (!parentChapter) {
      return err("ChapterNotFound");
    }

    const isSameChapter = targetChapter.id === parentChapter.id;
    const isNextChapter = targetChapter.index === parentChapter.index + 1;

    // Case 1: Continuing in the same chapter - always allowed
    if (isSameChapter) {
      return ok(undefined);
    }

    // Case 2: Moving to the next chapter
    if (isNextChapter) {
      // The next chapter must not already have turns
      // (This ensures clean chapter transitions)
      if (targetChapter.firstTurnId !== null) {
        return err("ChapterAlreadyStarted");
      }
      return ok(undefined);
    }

    // Case 3: Any other progression is invalid
    // (next turn cannot skip chapters or go backwards)
    return err("ChapterProgressionInvalid");
  } catch {
    return err("LoadFailed");
  }
}

// old neverthrow version, feels very unergonomic
//
// import { err, ok, type Result, ResultAsync } from "neverthrow";
//
// export type TurnChapterErr =
//   | "LoadFailed"
//   | "ParentTurnNotFound"
//   | "ChapterNotFound"
//   | "ChapterScenarioMismatch"
//   | "ParentTurnScenarioMismatch"
//   | "ChapterAlreadyStarted"
//   | "ChapterProgressionInvalid";
//
// type ChapterLite = {
//   id: string;
//   scenarioId: string;
//   index: number;
//   firstTurnId: string | null;
// };
//
// type TurnLite = {
//   id: string;
//   chapterId: string;
//   scenarioId: string;
// };
//
// type ChapterLoaders = {
//   loadChapter: (chapterId: string) => Promise<ChapterLite | undefined>;
//   loadTurn: (turnId: string) => Promise<TurnLite | undefined>;
// };
//
// /**
//  * Validate whether a turn can be appended to a chapter in the scenario.
//  * This checks the chapter's existence, scenario association, and whether the
//  * turn can be appended as a root or under an existing parent turn.
//  */
// export function canAppendTurnToChapter(args: {
//   scenarioId: string;
//   targetChapterId: string;
//   parentTurnId: string | null;
//   loaders: ChapterLoaders;
// }): ResultAsync<void, TurnChapterErr> {
//   const { scenarioId, targetChapterId, parentTurnId, loaders } = args;
//
//   return ResultAsync.fromPromise(
//     loaders.loadChapter(targetChapterId),
//     () => "LoadFailed" as const
//   ).andThen((targetChapter) => {
//     // Target chapter must exist
//     if (!targetChapter) {
//       return err("ChapterNotFound");
//     }
//
//     // Target chapter must belong to the scenario
//     if (targetChapter.scenarioId !== scenarioId) {
//       return err("ChapterScenarioMismatch");
//     }
//
//     // Branch based on whether we have a parent turn
//     if (parentTurnId === null) {
//       // Root insertion case: creating the first turn in a timeline
//       return validateRootInsertion(targetChapter);
//     } else {
//       // Normal append/branch case: adding to existing timeline
//       return validateNormalAppend({
//         parentTurnId,
//         targetChapter,
//         scenarioId,
//         loaders,
//       });
//     }
//   });
// }
//
// /**
//  * Validate rules for inserting a root turn, which is the first turn in the
//  * scenario.
//  */
// function validateRootInsertion(
//   targetChapter: ChapterLite
// ): Result<void, TurnChapterErr> {
//   // Root turns can only be created in chapter 0
//   if (targetChapter.index !== 0) {
//     return err("ChapterProgressionInvalid");
//   }
//
//   // Chapter shouldn't already have a first turn
//   if (targetChapter.firstTurnId !== null) {
//     return err("ChapterAlreadyStarted");
//   }
//
//   return ok(undefined);
// }
//
// /**
//  * Validate rules for appending a turn to the scenario under an existing turn.
//  */
// function validateNormalAppend(args: {
//   parentTurnId: string;
//   targetChapter: ChapterLite;
//   scenarioId: string;
//   loaders: ChapterLoaders;
// }): ResultAsync<void, TurnChapterErr> {
//   const { parentTurnId, targetChapter, scenarioId, loaders } = args;
//
//   // Load the parent turn
//   return ResultAsync.fromPromise(
//     loaders.loadTurn(parentTurnId),
//     () => "LoadFailed" as const
//   ).andThen((parentTurn) => {
//     // Parent turn must exist when ID was provided
//     if (!parentTurn) {
//       return err("ParentTurnNotFound");
//     }
//
//     // Parent turn must belong to the same scenario
//     if (parentTurn.scenarioId !== scenarioId) {
//       return err("ParentTurnScenarioMismatch");
//     }
//
//     // Now validate chapter progression
//     return validateChapterProgression({ parentTurn, targetChapter, loaders });
//   });
// }
//
// /**
//  * Validate the chapter progression rules based on the parent turn and target
//  * chapter.
//  */
// function validateChapterProgression(args: {
//   parentTurn: TurnLite;
//   targetChapter: ChapterLite;
//   loaders: ChapterLoaders;
// }): ResultAsync<void, TurnChapterErr> {
//   const { parentTurn, targetChapter, loaders } = args;
//
//   // Load parent's chapter to compare indices
//   return ResultAsync.fromPromise(
//     loaders.loadChapter(parentTurn.chapterId),
//     () => "LoadFailed" as const
//   ).andThen((parentChapter) => {
//     if (!parentChapter) {
//       return err("ChapterNotFound");
//     }
//
//     const isSameChapter = targetChapter.id === parentChapter.id;
//     const isNextChapter = targetChapter.index === parentChapter.index + 1;
//
//     // Case 1: Continuing in the same chapter - always allowed
//     if (isSameChapter) {
//       return ok(undefined);
//     }
//
//     // Case 2: Moving to the next chapter
//     if (isNextChapter) {
//       // The next chapter must not already have turns
//       // (This ensures clean chapter transitions)
//       if (targetChapter.firstTurnId !== null) {
//         return err("ChapterAlreadyStarted");
//       }
//       return ok(undefined);
//     }
//
//     // Case 3: Any other progression is invalid
//     // (next turn cannot skip chapters or go backwards)
//     return err("ChapterProgressionInvalid");
//   });
// }

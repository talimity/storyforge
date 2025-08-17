import { err, ok, type Result } from "@storyforge/utils";

export type TurnChapterErr =
  | "LoadFailed"
  | "ParentTurnNotFound"
  | "ChapterNotFound"
  | "ChapterScenarioMismatch"
  | "ParentTurnScenarioMismatch"
  | "ChapterProgressionInvalid";

type ChapterLite = {
  id: string;
  scenarioId: string;
  index: number;
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
      if (targetChapter.index !== 0) {
        return err("ChapterProgressionInvalid");
      }

      return ok(undefined);
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
      return ok(undefined);
    }

    // Case 3: Any other progression is invalid
    // (next turn cannot skip chapters or go backwards)
    return err("ChapterProgressionInvalid");
  } catch {
    return err("LoadFailed");
  }
}

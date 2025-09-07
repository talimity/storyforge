import type { ScenarioParticipant } from "@storyforge/db";
import { err, ok, type Result } from "@storyforge/utils";

export type TurnErr =
  | "LoadFailed"
  | "ParticipantNotFound"
  | "ParticipantInactive"
  | "CrossScenarioAuthor"
  | "CannotPromoteMultipleToRoot";

type AuthorParticipant = {
  scenarioId: string;
  status: ScenarioParticipant["status"];
};

type AuthorParticipantLoaders = {
  loadAuthorParticipant: (participantId: string) => Promise<AuthorParticipant | undefined>;
};

/**
 * Validate that the author participant can create a turn in the given scenario.
 * This checks if the author is active and belongs to the scenario.
 */
export async function canCreateTurn(args: {
  scenarioId: string;
  authorParticipantId: string;
  loaders: AuthorParticipantLoaders;
}): Promise<Result<void, TurnErr>> {
  const { scenarioId, authorParticipantId, loaders } = args;

  try {
    const author = await loaders.loadAuthorParticipant(authorParticipantId);

    // Author must exist
    if (!author) {
      return err("ParticipantNotFound");
    }

    // Author must be active
    if (author.status !== "active") {
      return err("ParticipantInactive");
    }

    // Author must belong to the scenario
    if (author.scenarioId !== scenarioId) {
      return err("CrossScenarioAuthor");
    }

    return ok(undefined);
  } catch {
    return err("LoadFailed");
  }
}

/**
 * Check if a turn's children can be promoted into its place. If the turn is
 * the root turn, it cannot have multiple children promoted to root.
 */
export function canPromoteChildren(args: {
  turn: { parentTurnId: string | null };
  childCount: number;
}): Result<void, TurnErr> {
  if (args.turn.parentTurnId === null && args.childCount > 1) {
    return err("CannotPromoteMultipleToRoot");
  }
  return ok(undefined);
}

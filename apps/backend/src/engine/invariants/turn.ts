import { err, ok, type Result } from "@storyforge/utils";

export type TurnErr =
  | "LoadFailed"
  | "ParticipantNotFound"
  | "ParticipantInactive"
  | "CrossScenarioAuthor";

type AuthorParticipant = { scenarioId: string; isActive: boolean };

type AuthorParticipantLoaders = {
  loadAuthorParticipant: (
    participantId: string
  ) => Promise<AuthorParticipant | undefined>;
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
    if (!author.isActive) {
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

import type {
  ScenarioParticipant as ApiScenarioParticipant,
  ScenarioWithCharacters as ApiScenarioWithCharacters,
} from "@storyforge/contracts";
import { transformCharacterSummary } from "../character/character.transforms.js";
import type { ScenarioDetail } from "./scenario.queries.js";

export function transformScenarioParticipant(
  p: NonNullable<ScenarioDetail>["participants"][number]
): ApiScenarioParticipant {
  if (!p.character) {
    throw new Error(`Scenario participant ${p.id} has no character`);
  }

  return {
    ...p,
    character: transformCharacterSummary(p.character),
  };
}

export function transformScenarioDetail(
  sd: NonNullable<ScenarioDetail>
): ApiScenarioWithCharacters {
  const { participants, ...rest } = sd;
  return {
    ...rest,
    characters: participants.map(transformScenarioParticipant),
  };
}

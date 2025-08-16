import type {
  ScenarioParticipant as ApiScenarioParticipant,
  ScenarioWithCharacters as ApiScenarioWithCharacters,
} from "@storyforge/schemas";
import { transformCharacterSummary } from "@/library/character/character.transforms";
import type {
  ScenarioDetail,
  ScenarioOverview,
} from "@/library/scenario/scenario.queries";

export function transformScenarioParticipant(
  p: ScenarioOverview["participants"][number]
): ApiScenarioParticipant {
  if (!p.character) {
    throw new Error(`Scenario participant ${p.id} has no character`);
  }

  return {
    ...p,
    character: transformCharacterSummary(p.character),
  };
}

export function transformScenarioOverview(so: ScenarioOverview) {
  return {
    ...so,
    characters: so.participants.map(transformScenarioParticipant),
  };
}

export function transformScenarioDetail(
  sd: NonNullable<ScenarioDetail>
): ApiScenarioWithCharacters {
  return {
    ...sd,
    characters: sd.participants.map(transformScenarioParticipant),
  };
}

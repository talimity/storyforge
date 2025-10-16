import type {
  ScenarioParticipant as ApiScenarioParticipant,
  ScenarioWithCharacters as ApiScenarioWithCharacters,
  ScenarioLorebookItem,
} from "@storyforge/contracts";
import { transformCharacterSummary } from "../character/character.transforms.js";
import type { ScenarioDetail } from "./scenario.queries.js";

export function transformScenarioParticipant(
  p: NonNullable<ScenarioDetail>["participants"][number]
): ApiScenarioParticipant {
  if (!p.character) {
    throw new Error(`Scenario participant ${p.id} has no character`);
  }

  const character = transformCharacterSummary(p.character);
  const color = (p.colorOverride ?? character.defaultColor).toLowerCase();

  return {
    id: p.id,
    role: p.role,
    orderIndex: p.orderIndex,
    isUserProxy: p.isUserProxy,
    color,
    character,
  };
}

export function transformScenarioLorebook(
  lorebook: NonNullable<ScenarioDetail>["lorebooks"][number]
): ScenarioLorebookItem {
  if (lorebook.kind === "manual") {
    return {
      kind: "manual",
      manualAssignmentId: lorebook.manualAssignmentId,
      lorebookId: lorebook.lorebookId,
      name: lorebook.name,
      entryCount: lorebook.entryCount,
      enabled: lorebook.enabled,
      defaultEnabled: lorebook.defaultEnabled,
    } satisfies ScenarioLorebookItem;
  }

  return {
    kind: "character",
    lorebookId: lorebook.lorebookId,
    name: lorebook.name,
    entryCount: lorebook.entryCount,
    characterId: lorebook.characterId,
    characterLorebookId: lorebook.characterLorebookId,
    enabled: lorebook.enabled,
    defaultEnabled: lorebook.defaultEnabled,
    overrideEnabled: lorebook.overrideEnabled,
  } satisfies ScenarioLorebookItem;
}

export function transformScenarioDetail(
  sd: NonNullable<ScenarioDetail>
): ApiScenarioWithCharacters {
  const { participants, ...rest } = sd;
  return {
    ...rest,
    characters: participants.map(transformScenarioParticipant),
    lorebooks: sd.lorebooks.map(transformScenarioLorebook),
  };
}

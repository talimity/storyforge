import type {
  EnvironmentOutput,
  IntentInput,
  IntentKind,
  TimelineTurn,
} from "@storyforge/contracts";
import { assertNever } from "@storyforge/utils";
import { z } from "zod";

type ScenarioParticipant = EnvironmentOutput["participants"][number];

export const INTENT_KIND_CONFIG: Record<
  IntentKind,
  { requiresTarget: boolean; requiresText: boolean }
> = {
  manual_control: { requiresTarget: true, requiresText: true },
  guided_control: { requiresTarget: true, requiresText: true },
  narrative_constraint: { requiresTarget: false, requiresText: true },
  continue_story: { requiresTarget: false, requiresText: false },
};

const TEXT_LIMIT = 50_000;

const requiredTextSchema = z
  .string()
  .max(TEXT_LIMIT, "Guidance is too long")
  .refine((value) => value.trim().length > 0, {
    message: "Enter some guidance",
  });

export const intentFormSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("manual_control"),
    characterId: z.string().min(1, "Select a character"),
    text: requiredTextSchema,
  }),
  z.object({
    kind: z.literal("guided_control"),
    characterId: z.string().min(1, "Select a character"),
    text: requiredTextSchema,
  }),
  z.object({
    kind: z.literal("narrative_constraint"),
    characterId: z.string().nullable().optional(),
    text: requiredTextSchema,
  }),
  z.object({
    kind: z.literal("continue_story"),
    characterId: z.string().nullable().optional(),
    text: z.string().max(TEXT_LIMIT, "Guidance is too long"),
  }),
]);

export type IntentFormValues = z.infer<typeof intentFormSchema>;

export function getInitialIntentFormValues(
  turn: TimelineTurn | null,
  participants: ScenarioParticipant[]
): IntentFormValues {
  if (!turn?.intentProvenance) {
    return { kind: "continue_story", characterId: null, text: "" };
  }

  const { intentKind, inputText, targetParticipantId } = turn.intentProvenance;
  const participant = targetParticipantId
    ? (participants.find((p) => p.id === targetParticipantId) ?? null)
    : null;
  const characterId = participant?.characterId ?? null;
  const text = inputText ?? "";

  switch (intentKind) {
    case "manual_control":
      return { kind: "manual_control", characterId: characterId ?? "", text };
    case "guided_control":
      return { kind: "guided_control", characterId: characterId ?? "", text };
    case "narrative_constraint":
      return { kind: "narrative_constraint", characterId, text };
    case "continue_story":
      return { kind: "continue_story", characterId, text };
    default: {
      const exhaustiveCheck: never = intentKind;
      throw new Error(`Unsupported intent kind: ${exhaustiveCheck}`);
    }
  }
}

export function createIntentInputFromForm(
  values: IntentFormValues,
  participants: ScenarioParticipant[]
): IntentInput {
  switch (values.kind) {
    case "manual_control":
    case "guided_control": {
      const participant = findParticipantByCharacterId(values.characterId, participants);
      if (!participant) {
        throw new Error("Character selection could not be resolved to a participant");
      }
      return {
        kind: values.kind,
        targetParticipantId: participant.id,
        text: normalizeText(values.text),
      };
    }
    case "narrative_constraint":
      return {
        kind: "narrative_constraint",
        text: normalizeText(values.text),
      };
    case "continue_story":
      return { kind: "continue_story" };
    default: {
      assertNever(values);
    }
  }
}

function findParticipantByCharacterId(
  characterId: string,
  participants: ScenarioParticipant[]
): ScenarioParticipant | null {
  if (!characterId) return null;
  return participants.find((p) => p.characterId === characterId) ?? null;
}

function normalizeText(text: string): string {
  return text.trim();
}

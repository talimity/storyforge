import type { Intent } from "@storyforge/db";
import { assertNever } from "@storyforge/utils";

export function getTurnIntentPrompt(args: {
  kind: Intent["kind"] | null;
  targetName: string;
  text?: string | null;
}): { kind: Intent["kind"]; mappedKind?: string; prompt: string; text?: string } | undefined {
  const { kind, targetName, text } = args;
  if (!kind) return;

  let mappedKind = "";
  let prompt = "";
  switch (kind) {
    case "manual_control":
      mappedKind = "Control";
      prompt = `I'm controlling ${targetName} this turn.`;
      break;
    case "guided_control":
      mappedKind = "Character Direction";
      prompt = `Incorporate this direction into ${targetName}'s turn: ${text}`;
      break;
    case "narrative_constraint":
      mappedKind = "Narrative Constraint";
      prompt = `Continue the story under this narrative constraint: ${text}`;
      break;
    case "continue_story":
      mappedKind = "Continue Story";
      prompt = "Matching the current tone and pace of the scene, continue the story as you like.";
      break;
    default:
      assertNever(kind);
  }
  return { kind, mappedKind, prompt, text: text ?? undefined };
}

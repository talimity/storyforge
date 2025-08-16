import type { LoadedContext } from "@/library/context-loader";

export type TurnMessage = {
  role: "system" | "narrator" | "character" | "tool";
  name?: string;
  content: string;
  turnId?: string; // traceability
};

export type PromptBuildSpec = {
  tokenBudget: number; // soft budget for message packing
};

export type BuiltPrompt = {
  system: string; // final system prompt text
  messages: TurnMessage[]; // ordered root -> leaf for the model input
  meta: {
    usedTurns: string[]; // ids included in the budget
  };
};

export function buildPrompt(
  loaded: LoadedContext,
  spec: PromptBuildSpec
): BuiltPrompt {
  const { tokenBudget } = spec;

  // 1) System prompt (template + scenario settings). For now, trivial.
  const system =
    loaded.systemTemplate ?? "You are the narrative engine. Keep continuity.";

  // 2) Optional character bios (very short – caller should pre-trim).
  const bios: TurnMessage[] = loaded.participants.map((p) => ({
    role: "system",
    name: p.character.name,
    content: p.character.description ?? "",
  }));

  // 3) Pack timeline into messages, root -> leaf. At this stage we don’t have
  //    per-turn message content yet, so stub a join key for when it arrives.
  const timelineMessages: TurnMessage[] = loaded.timeline.map((node) => ({
    role: "narrator",
    content: `Turn ${node.id} (depth ${node.depth})`, // TODO: replace with actual turn text
    turnId: node.id,
  }));

  // 4) Very naive token budget handling – caller can inject a real counter later.
  const naiveToken = (s: string) => Math.ceil(s.split(/\s+/).length * 1.3);
  const pack: TurnMessage[] = [];
  let budget = tokenBudget;

  for (const m of [...bios, ...timelineMessages]) {
    const cost = naiveToken(m.content);
    if (cost > budget) break;
    pack.push(m);
    budget -= cost;
  }

  return {
    system,
    messages: pack,
    meta: { usedTurns: pack.map((m) => m.turnId).filter(Boolean) as string[] },
  };
}

import type { LoadedContext } from "@/library/context-loader";

export type TurnMessage = {
  role: "system" | "narrator" | "character" | "tool";
  name?: string;
  content: string;
  turnId?: string; // traceability
};

export type PromptBuildSpec = {
  /**
   * The maximum number of tokens to use in the prompt. This is a very rough
   * estimate; callers should set the budget below the absolute maximum a model
   * can handle to avoid errors.
   */
  tokenBudget: number;
  /**
   * The key of the turn content layer to include in the prompt. This allows
   * constructing a generation prompt that only sees certain layers of the turn
   * content, e.g. "presentation" or "planning".
   *
   * TODO: Support multiple layers in the future.
   */
  layer: string;
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
  const { tokenBudget, layer } = spec;
  // 0) Validate the loaded context.
  if (loaded.timeline.length === 0) {
    throw new Error("Timeline is empty, cannot build prompt");
  }
  if (loaded.participants.length === 0) {
    throw new Error("No participants found, cannot build prompt");
  }
  assertHasLayer(loaded, layer);

  // 1) System prompt (template + scenario settings). For now, trivial.
  const system =
    loaded.systemTemplate ?? "You are the narrative engine. Keep continuity.";

  const charaDescriptions: TurnMessage[] = loaded.participants.map((p) => ({
    role: "system",
    name: p.character.name,
    content: p.character.description,
  }));

  // 3) Pack timeline into messages, root -> leaf using the actual turn content
  const timelineMessages: TurnMessage[] = loaded.timeline.map((node) => {
    const turnLayers = loaded.contentByTurnId[node.id];
    const content = turnLayers[layer];

    return {
      role: "narrator",
      content,
      turnId: node.id,
    };
  });

  // 4) Very naive token budget handling – caller can inject a real counter later.
  const naiveToken = (s: string) => Math.ceil(s.split(/\s+/).length * 1.3);
  const pack: TurnMessage[] = [];
  let budget = tokenBudget;

  for (const m of [...charaDescriptions, ...timelineMessages]) {
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

// Utility to verify that all turns have the requested content layer.
// Not gonna work long-term since technically valid past turns might have been
// generated with a different config which used different layers.
// Eventually probably need an `onMissingLayer` spec option.
function assertHasLayer(loaded: LoadedContext, layer: string): void {
  for (const turnId in loaded.contentByTurnId) {
    const layers = loaded.contentByTurnId[turnId];
    if (!(layer in layers)) {
      throw new Error(`Turn ${turnId} is missing requested layer "${layer}"`);
    }
  }
}

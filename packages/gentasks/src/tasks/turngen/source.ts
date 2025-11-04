import { makeRegistry } from "@storyforge/prompt-rendering";
import { exactKeys } from "@storyforge/utils";
import {
  makeNarrativeSourceHandlers,
  NARRATIVE_SOURCE_NAMES,
  type NarrativeSources,
} from "../shared/source.js";
import type { TurnGenContext, TurnGenGlobals } from "./context.js";

export type TurnGenSources = NarrativeSources & {
  currentIntent: { args: never; out: TurnGenContext["currentIntent"] };
  globals: { args: never; out: TurnGenGlobals };
};

export const turnGenRegistry = makeRegistry<TurnGenContext, TurnGenSources>({
  ...makeNarrativeSourceHandlers<TurnGenContext>(),
  currentIntent: (_ref, ctx) => ctx.currentIntent,
  globals: (_ref, ctx) => ctx.globals,
});

export const TURN_GEN_SOURCE_NAMES = exactKeys<TurnGenSources>()(
  ...NARRATIVE_SOURCE_NAMES,
  "currentIntent",
  "globals"
);

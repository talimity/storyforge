import type { createIntentInputSchema } from "@storyforge/schemas";
import type { z } from "zod";
import { trpc } from "@/lib/trpc";

type CreateIntentInput = z.infer<typeof createIntentInputSchema>;

export function useScenarioIntent() {
  const utils = trpc.useUtils();

  const createIntentMutation = trpc.play.createIntent.useMutation({
    onSuccess: (_data) => {
      utils.play.timeline.invalidate();
      utils.play.environment.invalidate();
    },
  });

  const debugAddTurnMutation = trpc.play._debugAddNodeToGraph.useMutation({
    onSuccess: () => {
      utils.play.timeline.invalidate();
      utils.play.environment.invalidate();
    },
  });

  const createIntent = async (input: CreateIntentInput) => {
    return createIntentMutation.mutateAsync(input);
  };

  const debugAddTurn = async (
    scenarioId: string,
    text: string,
    authorParticipantId: string,
    chapterId: string
  ) => {
    return debugAddTurnMutation.mutateAsync({
      scenarioId,
      text,
      authorParticipantId,
      chapterId,
    });
  };

  return {
    createIntent,
    debugAddTurn,
    isCreatingIntent: createIntentMutation.isPending,
    isAddingTurn: debugAddTurnMutation.isPending,
  };
}

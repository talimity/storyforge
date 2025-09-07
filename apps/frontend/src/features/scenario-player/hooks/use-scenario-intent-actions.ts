import type { createIntentInputSchema } from "@storyforge/contracts";
import type { z } from "zod";
import { trpc } from "@/lib/trpc";

type CreateIntentInput = z.infer<typeof createIntentInputSchema>;

export function useScenarioIntentActions() {
  const utils = trpc.useUtils();

  const createIntentMutation = trpc.play.createIntent.useMutation({
    onSuccess: (_data) => {
      utils.play.timeline.invalidate();
      utils.play.environment.invalidate();
    },
  });

  const addTurnMutation = trpc.play.addTurn.useMutation({
    onSuccess: () => {
      utils.play.timeline.invalidate();
      utils.play.environment.invalidate();
    },
  });

  const createIntent = async (input: CreateIntentInput) => {
    return createIntentMutation.mutateAsync(input);
  };

  const addTurn = async (
    scenarioId: string,
    text: string,
    authorParticipantId: string,
    chapterId: string
  ) => {
    return addTurnMutation.mutateAsync({
      scenarioId,
      text,
      authorParticipantId,
      chapterId,
    });
  };

  return {
    createIntent,
    addTurn,
    isCreatingIntent: createIntentMutation.isPending,
    isAddingTurn: addTurnMutation.isPending,
  };
}

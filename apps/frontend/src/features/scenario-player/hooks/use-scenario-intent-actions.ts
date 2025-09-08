import type { createIntentInputSchema } from "@storyforge/contracts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { z } from "zod";
import { useTRPC } from "@/lib/trpc";

type CreateIntentInput = z.infer<typeof createIntentInputSchema>;

export function useScenarioIntentActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const createIntentMutation = useMutation(
    trpc.play.createIntent.mutationOptions({
      onSuccess: (_data) => {
        queryClient.invalidateQueries(trpc.play.timeline.pathFilter());
        queryClient.invalidateQueries(trpc.play.environment.pathFilter());
      },
    })
  );

  const addTurnMutation = useMutation(
    trpc.play.addTurn.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.play.timeline.pathFilter());
        queryClient.invalidateQueries(trpc.play.environment.pathFilter());
      },
    })
  );

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

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/lib/trpc";

export function useScenarioIntentActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries(trpc.timeline.window.pathFilter());
    queryClient.invalidateQueries(trpc.scenarios.playEnvironment.pathFilter());
  }, [queryClient, trpc]);
  const { mutateAsync: createIntent, isPending: isCreatingIntent } = useMutation(
    trpc.intents.createIntent.mutationOptions({ onSuccess: invalidate })
  );
  const { mutateAsync: addTurn, isPending: isAddingTurn } = useMutation(
    trpc.timeline.addTurn.mutationOptions({ onSuccess: invalidate })
  );

  return { createIntent, addTurn, isCreatingIntent, isAddingTurn };
}

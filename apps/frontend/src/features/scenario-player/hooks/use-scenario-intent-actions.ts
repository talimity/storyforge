import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { useTRPC } from "@/lib/trpc";

export function useScenarioIntentActions() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const invalidate = useCallback(() => {
    queryClient.invalidateQueries(trpc.play.timeline.pathFilter());
    queryClient.invalidateQueries(trpc.play.environment.pathFilter());
  }, [queryClient, trpc]);
  const { mutateAsync: createIntent, isPending: isCreatingIntent } = useMutation(
    trpc.play.createIntent.mutationOptions({ onSuccess: invalidate })
  );
  const { mutateAsync: addTurn, isPending: isAddingTurn } = useMutation(
    trpc.play.addTurn.mutationOptions({ onSuccess: invalidate })
  );

  return { createIntent, addTurn, isCreatingIntent, isAddingTurn };
}

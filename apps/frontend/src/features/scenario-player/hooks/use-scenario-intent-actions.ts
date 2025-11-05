import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";
import { useScenarioDataInvalidator } from "./use-scenario-data-invalidator";

export function useScenarioIntentActions() {
  const trpc = useTRPC();
  const { invalidateCore } = useScenarioDataInvalidator();

  const { mutateAsync: createIntent } = useMutation(
    trpc.intents.createIntent.mutationOptions({ onSuccess: invalidateCore })
  );
  const { mutateAsync: addTurn } = useMutation(
    trpc.timeline.addTurn.mutationOptions({ onSuccess: invalidateCore })
  );
  const { mutateAsync: insertTurnAfter } = useMutation(
    trpc.timeline.insertTurnAfter.mutationOptions({ onSuccess: invalidateCore })
  );

  return { createIntent, addTurn, insertTurnAfter };
}

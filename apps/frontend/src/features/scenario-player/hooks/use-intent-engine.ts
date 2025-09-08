import type { IntentInput } from "@storyforge/contracts";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useCallback } from "react";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { useTRPC } from "@/lib/trpc";

export function useIntentEngine(scenarioId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const startRun = useIntentRunsStore((s) => s.startRun);
  const applyEvent = useIntentRunsStore((s) => s.applyEvent);
  const clearActiveIntent = useIntentRunsStore((s) => s.clearActiveRun);
  const currentRunId = useIntentRunsStore((s) => s.currentRunId);

  const createIntent = useMutation(trpc.play.createIntent.mutationOptions());
  const interruptIntent = useMutation(trpc.play.interruptIntent.mutationOptions({}));
  const { data: env } = useQuery(trpc.play.environment.queryOptions({ scenarioId }));

  const startIntent = useCallback(
    async (parameters: IntentInput) => {
      const { intentId } = await createIntent.mutateAsync({ scenarioId, parameters });

      startRun({ intentId, scenarioId, kind: parameters.kind });
      // After creating, subscription would attach below
      return intentId;
    },
    [scenarioId, createIntent, startRun]
  );
  const cancelIntent = useCallback(
    async (intentId: string) => await interruptIntent.mutateAsync({ intentId }),
    [interruptIntent]
  );

  // Attach subscription when we have either:
  //  - a run we just started (runs.currentId), or
  //  - an existing generating intent from the server (resume after refresh)
  const activeIntentId = currentRunId ?? env?.generatingIntent?.id ?? null;
  const progressSubscription = useSubscription(
    trpc.play.intentProgress.subscriptionOptions(
      activeIntentId ? { intentId: activeIntentId } : skipToken,
      {
        onData: (event) => {
          applyEvent(event);

          if (event.type === "effect_committed") {
            // Get the next authoritative data from server
            queryClient.invalidateQueries({ queryKey: [["play", "timeline"]] });
            queryClient.invalidateQueries({ queryKey: [["play", "environment"]] });
          }
          if (event.type === "intent_finished") {
            clearActiveIntent();
          }
          if (event.type === "intent_failed") {
            // Keep the run visible for UI; do not clear immediately
            // (Let UI clear on explicit action or scenario change)
          }
        },
      }
    )
  );

  return { startIntent, progressSubscription, cancelIntent };
}

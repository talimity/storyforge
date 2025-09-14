import type { IntentInput } from "@storyforge/contracts";
import { skipToken, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useCallback, useEffect, useRef } from "react";
import { useIntentRunsStore } from "@/features/scenario-player/stores/intent-run-store";
import { showErrorToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

type BranchFrom = { kind: "turn_parent" | "intent_start"; targetId: string };

export function useIntentEngine(scenarioId: string) {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const startRun = useIntentRunsStore((s) => s.startRun);
  const applyEvent = useIntentRunsStore((s) => s.applyEvent);
  const clearActiveIntent = useIntentRunsStore((s) => s.clearActiveRun);
  const currentRunId = useIntentRunsStore((s) => s.currentRunId);
  const { data: env } = useQuery(trpc.play.environment.queryOptions({ scenarioId }));
  const createIntent = useMutation(
    trpc.play.createIntent.mutationOptions({
      onError: (err) => showErrorToast({ title: "Failed to start intent", error: err }),
    })
  );
  const interruptIntent = useMutation(
    trpc.play.interruptIntent.mutationOptions({
      onError: (err) => showErrorToast({ title: "Failed to cancel intent", error: err }),
    })
  );

  const startIntent = useCallback(
    async (parameters: IntentInput, opts?: { branchFrom?: BranchFrom }) => {
      const { intentId } = await createIntent.mutateAsync({
        scenarioId,
        parameters,
        branchFrom: opts?.branchFrom,
      });

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

  // After a page refresh, the server may have a generating intent that React
  // doesn't know about. We will sync the store here.
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    syncedRef.current = true;

    if (currentRunId) return;
    if (!env?.generatingIntent) return;

    startRun({
      intentId: env.generatingIntent.id,
      scenarioId: env.generatingIntent.scenarioId,
      kind: env.generatingIntent.kind,
    });
  }, [currentRunId, env, startRun]);

  // Attach subscription when we have either:
  //  - a run we just started (runs.currentId), or
  //  - an existing generating intent from the server (resume after refresh)
  const activeIntentId = currentRunId ?? env?.generatingIntent?.id ?? null;
  const subscriptionEnabled = Boolean(activeIntentId);
  const subscriptionInput = subscriptionEnabled ? { intentId: String(activeIntentId) } : skipToken;
  useSubscription(
    trpc.play.intentProgress.subscriptionOptions(subscriptionInput, {
      enabled: subscriptionEnabled,

      onData: (event) => {
        if (!currentRunId) return;
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
          showErrorToast({ title: "Generation failed", error: event.error });
          // Keep the run visible for UI; do not clear immediately
        }
      },
      onError: (err) => {
        // Subscription transport error or server error shape
        showErrorToast({ title: "Generation progress error", error: err });
      },
    })
  );

  return { startIntent, cancelIntent };
}

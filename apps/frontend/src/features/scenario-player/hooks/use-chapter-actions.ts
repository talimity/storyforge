import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { showErrorToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import { useScenarioContext } from "../providers/scenario-provider";

interface InsertChapterArgs {
  turnId: string;
  title?: string;
}

interface RenameChapterArgs {
  eventId: string;
  title: string;
}

interface DeleteChapterArgs {
  eventId: string;
}

export function useChapterActions() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { scenario } = useScenarioContext();

  const invalidate = useCallback(async () => {
    await Promise.all([
      qc.invalidateQueries(trpc.timeline.window.pathFilter()),
      qc.invalidateQueries(trpc.timeline.state.pathFilter()),
      qc.invalidateQueries(trpc.scenarios.playEnvironment.pathFilter()),
      qc.invalidateQueries(trpc.chapterSummaries.listForPath.pathFilter()),
      qc.invalidateQueries(trpc.chapterSummaries.status.pathFilter()),
      qc.invalidateQueries(trpc.chapterSummaries.get.pathFilter()),
    ]);
  }, [qc, trpc]);

  const insertChapterBreakMutation = useMutation(
    trpc.timelineEvents.insertChapterBreakEvent.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to insert chapter break", error });
      },
      onSuccess: async () => {
        await invalidate();
      },
    })
  );

  const renameChapterBreakMutation = useMutation(
    trpc.timelineEvents.renameChapter.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to rename chapter", error });
      },
      onSuccess: async () => {
        await invalidate();
      },
    })
  );

  const deleteChapterBreakMutation = useMutation(
    trpc.timelineEvents.deleteTimelineEvent.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to delete chapter", error });
      },
      onSuccess: async () => {
        await invalidate();
      },
    })
  );

  const insertChapterAtTurn = useCallback(
    async ({ turnId, title }: InsertChapterArgs) => {
      return insertChapterBreakMutation.mutateAsync({
        scenarioId: scenario.id,
        turnId,
        nextChapterTitle: title || null,
      });
    },
    [insertChapterBreakMutation, scenario.id]
  );

  const renameChapter = useCallback(
    async ({ eventId, title }: RenameChapterArgs) => {
      return renameChapterBreakMutation.mutateAsync({
        scenarioId: scenario.id,
        eventId,
        nextChapterTitle: title || null,
      });
    },
    [renameChapterBreakMutation, scenario.id]
  );

  const deleteChapter = useCallback(
    async ({ eventId }: DeleteChapterArgs) => {
      return deleteChapterBreakMutation.mutateAsync({ eventId });
    },
    [deleteChapterBreakMutation]
  );

  return {
    insertChapterAtTurn,
    renameChapter,
    deleteChapter,
    isInsertingChapter: insertChapterBreakMutation.isPending,
    isRenamingChapter: renameChapterBreakMutation.isPending,
    isDeletingChapter: deleteChapterBreakMutation.isPending,
  };
}

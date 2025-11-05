import { useMutation } from "@tanstack/react-query";
import { useScenarioDataInvalidator } from "@/features/scenario-player/hooks/use-scenario-data-invalidator";
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
  const { scenario } = useScenarioContext();
  const { invalidateWithChapters } = useScenarioDataInvalidator();

  const insertChapterBreakMutation = useMutation(
    trpc.timelineEvents.insertChapterBreakEvent.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to insert chapter break", error });
      },
      onSuccess: async () => {
        await invalidateWithChapters();
      },
    })
  );

  const renameChapterBreakMutation = useMutation(
    trpc.timelineEvents.renameChapter.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to rename chapter", error });
      },
      onSuccess: async () => {
        await invalidateWithChapters();
      },
    })
  );

  const deleteChapterBreakMutation = useMutation(
    trpc.timelineEvents.deleteTimelineEvent.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to delete chapter", error });
      },
      onSuccess: async () => {
        await invalidateWithChapters();
      },
    })
  );

  const insertChapterAtTurn = async ({ turnId, title }: InsertChapterArgs) =>
    insertChapterBreakMutation.mutateAsync({
      scenarioId: scenario.id,
      turnId,
      nextChapterTitle: title || null,
    });

  const renameChapter = async ({ eventId, title }: RenameChapterArgs) =>
    renameChapterBreakMutation.mutateAsync({
      scenarioId: scenario.id,
      eventId,
      nextChapterTitle: title,
    });

  const deleteChapter = async ({ eventId }: DeleteChapterArgs) =>
    deleteChapterBreakMutation.mutateAsync({ eventId });

  return {
    insertChapterAtTurn,
    renameChapter,
    deleteChapter,
    isInsertingChapter: insertChapterBreakMutation.isPending,
    isRenamingChapter: renameChapterBreakMutation.isPending,
    isDeletingChapter: deleteChapterBreakMutation.isPending,
  };
}

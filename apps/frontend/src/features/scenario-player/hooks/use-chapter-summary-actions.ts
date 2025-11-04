import { useMutation, useQueryClient } from "@tanstack/react-query";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import { useScenarioContext } from "../providers/scenario-provider";

interface SummarizeArgs {
  closingEventId: string;
  force?: boolean;
}

interface SaveSummaryArgs {
  closingEventId: string;
  summaryText: string;
}

export function useChapterSummaryActions() {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const { scenario } = useScenarioContext();

  const invalidateQueries = async () => {
    await Promise.all([
      qc.invalidateQueries(trpc.chapterSummaries.listForPath.pathFilter()),
      qc.invalidateQueries(trpc.chapterSummaries.status.pathFilter()),
      qc.invalidateQueries(trpc.chapterSummaries.get.pathFilter()),
    ]);
  };

  const summarizeMutation = useMutation(
    trpc.chapterSummaries.summarize.mutationOptions({
      onSuccess: async () => {
        await invalidateQueries();
        showSuccessToast({ title: "Chapter summarization started" });
      },
      onError: (error) => {
        showErrorToast({ title: "Failed to start chapter summarization", error });
      },
    })
  );

  const saveMutation = useMutation(
    trpc.chapterSummaries.save.mutationOptions({
      onSuccess: async (_data, variables) => {
        await invalidateQueries();
        const wasCleared = variables.summaryText.trim().length === 0;
        showSuccessToast({
          title: wasCleared ? "Chapter summary cleared" : "Chapter summary saved",
        });
      },
      onError: (error) => {
        showErrorToast({ title: "Failed to save chapter summary", error });
      },
    })
  );

  async function summarizeChapter({ closingEventId, force }: SummarizeArgs) {
    return summarizeMutation.mutateAsync({
      scenarioId: scenario.id,
      closingEventId,
      force,
    });
  }

  async function saveSummary({ closingEventId, summaryText }: SaveSummaryArgs) {
    return saveMutation.mutateAsync({
      scenarioId: scenario.id,
      closingEventId,
      summaryText,
    });
  }

  return {
    summarizeChapter,
    saveSummary,
    isSummarizing: summarizeMutation.isPending,
    isSaving: saveMutation.isPending,
  };
}

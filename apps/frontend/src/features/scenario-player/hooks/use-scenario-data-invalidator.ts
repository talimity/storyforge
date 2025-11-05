import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useScenarioDataInvalidator() {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  const invalidateCore = async () => {
    await Promise.all([
      queryClient.invalidateQueries(trpc.timeline.window.pathFilter()),
      queryClient.invalidateQueries(trpc.timeline.state.pathFilter()),
      queryClient.invalidateQueries(trpc.scenarios.playEnvironment.pathFilter()),
      queryClient.invalidateQueries(trpc.timeline.nextActor.pathFilter()),
    ]);
  };

  const invalidateWithChapters = async () => {
    await Promise.all([
      invalidateCore(),
      queryClient.invalidateQueries(trpc.chapterSummaries.listForPath.pathFilter()),
      queryClient.invalidateQueries(trpc.chapterSummaries.status.pathFilter()),
      queryClient.invalidateQueries(trpc.chapterSummaries.get.pathFilter()),
    ]);
  };

  return { invalidateCore, invalidateWithChapters };
}

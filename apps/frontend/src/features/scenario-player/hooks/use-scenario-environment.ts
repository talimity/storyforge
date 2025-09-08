import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useScenarioEnvironment(scenarioId: string) {
  const trpc = useTRPC();
  const _envQuery = useSuspenseQuery(
    trpc.play.environment.queryOptions(
      { scenarioId },
      {
        staleTime: 5 * 60 * 1000, // Consider data fresh for 5 minutes
        gcTime: 30 * 60 * 1000, // Keep in cache for 30 minutes
        select: (data) => ({
          scenario: data.scenario,
          participants: data.participants,
          characters: data.characters,
          chapters: data.chapters,
          generatingIntent: data.generatingIntent,
        }),
      }
    )
  );

  const envData = _envQuery.data;

  return envData;
}

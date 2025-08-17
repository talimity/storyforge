import { trpc } from "@/lib/trpc";

export function useScenarioEnvironment(scenarioId: string) {
  const [envData, _envQuery] = trpc.play.environment.useSuspenseQuery(
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
  );

  return envData;
}

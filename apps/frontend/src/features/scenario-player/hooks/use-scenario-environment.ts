import { useSuspenseQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc";

export function useScenarioEnvironment(scenarioId: string) {
  const trpc = useTRPC();
  const query = useSuspenseQuery(
    trpc.scenarios.playEnvironment.queryOptions(
      { id: scenarioId },
      {
        select: (data) => ({
          scenario: data.scenario,
          participants: data.participants,
          characters: data.characters,
          generatingIntent: data.generatingIntent,
        }),
      }
    )
  );

  return query.data;
}

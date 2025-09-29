import type { timelineStateOutputSchema } from "@storyforge/contracts";
import { useQuery } from "@tanstack/react-query";
import type { z } from "zod";
import { useTRPC } from "@/lib/trpc";

export function useScenarioTimelineState({
  scenarioId,
  leafTurnId,
}: {
  scenarioId: string;
  leafTurnId?: string | null;
}) {
  const trpc = useTRPC();
  const query = useQuery({
    ...trpc.timeline.state.queryOptions(
      { scenarioId, atTurnId: leafTurnId ?? undefined },
      { select: (data) => data.state }
    ),
  });

  return (
    query.data ||
    ({
      chapters: { chapters: [] },
      presence: { participantPresence: {} },
    } satisfies z.infer<typeof timelineStateOutputSchema>["state"])
  );
}

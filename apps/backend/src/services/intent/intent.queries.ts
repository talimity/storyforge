import type { SqliteTxLike } from "@storyforge/db";

/**
 * Returns the currently generating intent for the scenario, including any
 * effects that have been generated so far.
 */
export async function getGeneratingIntent(db: SqliteTxLike, scenarioId: string) {
  const intent = await db.query.intents.findFirst({
    where: { scenarioId, status: { in: ["pending", "running"] } },
    with: {
      scenario: {
        columns: { anchorTurnId: true },
      },
      effects: {
        columns: { intentId: true, turnId: true, sequence: true, kind: true, createdAt: true },
        orderBy: (t, { asc }) => [asc(t.sequence)],
      },
    },
  });
  if (!intent || !intent.scenario) return null;

  return { id: intent.id, scenarioId, status: intent.status, effects: intent.effects };
}

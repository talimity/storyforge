import { type SqliteTxLike, schema } from "@storyforge/db";
import type { GenStep, GenWorkflow } from "@storyforge/gentasks";
import { assertDefined } from "@storyforge/utils";
import { and, eq, or, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm/sql/sql";

const { workflows, workflowScopes } = schema;

/**
 * Given the scope of a turn generation task, finds the workflow that best fits
 * the scope. If no scoped workflow is found, returns the default turn
 * generation workflow.
 */
export async function getTurngenWorkflowForScope(
  db: SqliteTxLike,
  scope: {
    scenarioId?: string;
    characterId?: string;
    participantId?: string;
  }
): Promise<GenWorkflow<"turn_generation">> {
  let characterId = scope.characterId;

  if (scope.participantId && !scope.characterId) {
    // providing participantId should also imply characterId
    const [participant] = await db
      .select({ characterId: schema.scenarioParticipants.characterId })
      .from(schema.scenarioParticipants)
      .where(eq(schema.scenarioParticipants.id, scope.participantId))
      .limit(1);
    characterId = participant?.characterId ?? undefined;
  }

  const orClauses: (SQL<unknown> | undefined)[] = [
    eq(workflowScopes.scopeKind, "default"),
  ];
  if (scope.participantId) {
    orClauses.push(
      and(
        eq(workflowScopes.scopeKind, "participant"),
        eq(workflowScopes.participantId, scope.participantId)
      )
    );
  }
  if (characterId) {
    orClauses.push(
      and(
        eq(workflowScopes.scopeKind, "character"),
        eq(workflowScopes.characterId, characterId)
      )
    );
  }
  if (scope.scenarioId) {
    orClauses.push(
      and(
        eq(workflowScopes.scopeKind, "scenario"),
        eq(workflowScopes.scenarioId, scope.scenarioId)
      )
    );
  }

  // Query for workflows with their scopes, filtering for turn_generation task
  const result = await db
    .select({
      workflow: workflows,
      scopeKind: workflowScopes.scopeKind,
    })
    .from(workflows)
    .innerJoin(workflowScopes, eq(workflows.id, workflowScopes.workflowId))
    .where(and(eq(workflows.task, "turn_generation"), or(...orClauses)))
    .orderBy(
      // Order by specificity: participant > character > scenario > default
      sql`CASE 
          WHEN ${workflowScopes.scopeKind} = 'participant' AND ${workflowScopes.participantId} IS NOT NULL THEN 1
          WHEN ${workflowScopes.scopeKind} = 'character' AND ${workflowScopes.characterId} IS NOT NULL THEN 2
          WHEN ${workflowScopes.scopeKind} = 'scenario' AND ${workflowScopes.scenarioId} IS NOT NULL THEN 3
          WHEN ${workflowScopes.scopeKind} = 'default' OR ${workflowScopes.scopeKind} IS NULL THEN 4
          ELSE 5
        END`
    )
    .limit(1);

  // There is always a seeded builtin workflow for each task kind which cannot
  // be deleted so this should never happen
  const workflow = result[0]?.workflow;
  assertDefined(
    workflow,
    "No turn_generation workflow found. At least one default workflow must exist."
  );

  // Parse the steps JSON and return as GenWorkflow
  return {
    id: workflow.id,
    name: workflow.name,
    description: workflow.description ?? undefined,
    task: "turn_generation",
    version: 1,
    steps: workflow.steps as GenStep[],
  };
}

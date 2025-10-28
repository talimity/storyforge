import {
  createWorkflowSchema,
  deleteWorkflowScopeSchema,
  duplicateWorkflowSchema,
  exportWorkflowResponseSchema,
  importWorkflowSchema,
  listWorkflowScopesQuerySchema,
  listWorkflowScopesResponseSchema,
  listWorkflowsQuerySchema,
  updateWorkflowSchema,
  upsertWorkflowScopeSchema,
  workflowDetailResponseSchema,
  workflowIdSchema,
  workflowOperationResponseSchema,
  workflowsListResponseSchema,
  workflowTestRunInputSchema,
  workflowTestRunOutputSchema,
} from "@storyforge/contracts";
import { schema } from "@storyforge/db";
import { genStepSchema, taskKindSchema } from "@storyforge/gentasks";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { WorkflowService } from "../../services/workflows/workflow.service.js";
import { WorkflowScopesService } from "../../services/workflows/workflow-scopes.service.js";
import { WorkflowTestService } from "../../services/workflows/workflow-test.service.js";
import { getWorkflowById, listWorkflows } from "../../services/workflows/workflows.queries.js";
import { publicProcedure, router } from "../index.js";

export const workflowsRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/workflows",
        tags: ["workflows"],
        summary: "List workflows",
      },
    })
    .input(listWorkflowsQuerySchema)
    .output(workflowsListResponseSchema)
    .query(async ({ input, ctx }) => {
      const workflows = await listWorkflows(ctx.db, input);
      return { workflows };
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/workflows/{id}",
        tags: ["workflows"],
        summary: "Get workflow by ID",
      },
    })
    .input(workflowIdSchema)
    .output(workflowDetailResponseSchema)
    .query(async ({ input, ctx }) => getWorkflowById(ctx.db, input.id)),

  create: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/workflows",
        tags: ["workflows"],
        summary: "Create workflow",
      },
    })
    .input(createWorkflowSchema)
    .output(workflowOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new WorkflowService(ctx.db);
      return service.createWorkflow(input);
    }),

  update: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/workflows/{id}",
        tags: ["workflows"],
        summary: "Update workflow",
      },
    })
    .input(z.object({ id: z.string(), data: updateWorkflowSchema }))
    .output(workflowOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new WorkflowService(ctx.db);
      return service.updateWorkflow(input.id, input.data);
    }),

  delete: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/workflows/{id}",
        tags: ["workflows"],
        summary: "Delete workflow",
      },
    })
    .input(workflowIdSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const service = new WorkflowService(ctx.db);
      await service.deleteWorkflow(input.id);
    }),

  duplicate: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/workflows/{id}/duplicate",
        tags: ["workflows"],
        summary: "Duplicate workflow",
      },
    })
    .input(duplicateWorkflowSchema)
    .output(workflowOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new WorkflowService(ctx.db);
      return service.duplicateWorkflow(input.id, input.name);
    }),

  // Import & export (optional parity with templates)
  import: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/workflows/import",
        tags: ["workflows"],
        summary: "Import a workflow from JSON",
      },
    })
    .input(importWorkflowSchema)
    .output(workflowOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new WorkflowService(ctx.db);
      // ignore id, enforce new id
      return service.createWorkflow({
        task: input.workflow.task,
        name: input.workflow.name,
        description: input.workflow.description,
        steps: input.workflow.steps,
      });
    }),

  export: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/workflows/{id}/export",
        tags: ["workflows"],
        summary: "Export a workflow as JSON",
      },
    })
    .input(workflowIdSchema)
    .output(exportWorkflowResponseSchema)
    .query(async ({ input, ctx }) => {
      const wf = await getWorkflowById(ctx.db, input.id);
      // Convert to genWorkflowSchema shape (no isBuiltIn/createdAt/updatedAt)
      const exported = {
        id: wf.id,
        name: wf.name,
        description: wf.description,
        task: wf.task,
        version: 1 as const,
        steps: wf.steps,
      };
      return { workflow: exported, exportedAt: new Date() };
    }),

  // Scope management endpoints
  listScopes: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/workflows/scopes",
        tags: ["workflows"],
        summary: "List workflow scope assignments",
      },
    })
    .input(listWorkflowScopesQuerySchema)
    .output(listWorkflowScopesResponseSchema)
    .query(async ({ input, ctx }) => {
      const { workflowScopes, workflows } = schema;
      const where = and(
        input.task ? eq(workflowScopes.workflowTask, input.task) : undefined,
        input.scopeKind ? eq(workflowScopes.scopeKind, input.scopeKind) : undefined,
        input.scenarioId ? eq(workflowScopes.scenarioId, input.scenarioId) : undefined,
        input.characterId ? eq(workflowScopes.characterId, input.characterId) : undefined,
        input.participantId ? eq(workflowScopes.participantId, input.participantId) : undefined
      );
      const rows = await ctx.db
        .select({ scope: workflowScopes, wf: workflows })
        .from(workflowScopes)
        .innerJoin(workflows, eq(workflowScopes.workflowId, workflows.id))
        .where(where);
      return {
        scopes: rows.map(({ scope, wf }) => ({
          id: scope.id,
          workflowId: scope.workflowId,
          workflowTask: taskKindSchema.parse(scope.workflowTask),
          scopeKind: scope.scopeKind,
          scenarioId: scope.scenarioId ?? undefined,
          characterId: scope.characterId ?? undefined,
          participantId: scope.participantId ?? undefined,
          createdAt: scope.createdAt,
          updatedAt: scope.updatedAt,
          workflow: {
            id: wf.id,
            name: wf.name,
            task: taskKindSchema.parse(wf.task),
            version: wf.version,
            stepCount: z.array(genStepSchema).parse(wf.steps).length,
            isBuiltIn: wf.isBuiltIn,
            createdAt: wf.createdAt,
            updatedAt: wf.updatedAt,
          },
        })),
      };
    }),

  upsertScope: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/workflows/scopes",
        tags: ["workflows"],
        summary: "Create or update a scope assignment",
      },
    })
    .input(upsertWorkflowScopeSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const svc = new WorkflowScopesService(ctx.db);
      await svc.upsertAssignment(input);
    }),

  deleteScope: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/workflows/scopes/{id}",
        tags: ["workflows"],
        summary: "Delete a scope assignment",
      },
    })
    .input(deleteWorkflowScopeSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const svc = new WorkflowScopesService(ctx.db);
      await svc.deleteAssignment(input.id);
    }),

  testRun: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/workflows/test-run",
        tags: ["workflows"],
        summary: "Run a workflow against a scenario/character using the Mock provider",
        enabled: false,
      },
    })
    .input(workflowTestRunInputSchema)
    .output(workflowTestRunOutputSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new WorkflowTestService(ctx.db);
      return service.runTest(input);
    }),
});

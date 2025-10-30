import {
  activatedLoreIndexSchema,
  assignScenarioManualLorebookSchema,
  type CharacterLinkedLorebook,
  characterIdSchema,
  characterLorebooksResponseSchema,
  createLorebookSchema,
  importLorebookFromCharacterSchema,
  importLorebookSchema,
  type LorebookDetail,
  linkCharacterLorebookSchema,
  lorebookActivationDebugResponseSchema,
  lorebookDataSchema,
  lorebookDetailSchema,
  lorebookIdSchema,
  lorebookImportResultSchema,
  lorebookSearchQuerySchema,
  lorebooksListResponseSchema,
  type ScenarioLorebookItem,
  scenarioIdSchema,
  scenarioLorebooksResponseSchema,
  unassignScenarioManualLorebookSchema,
  unlinkCharacterLorebookSchema,
  updateLorebookSchema,
  updateScenarioCharacterLorebookOverrideSchema,
  updateScenarioManualLorebookStateSchema,
} from "@storyforge/contracts";
import { scanLorebooks, scanLorebooksDebug, sortScenarioLorebooks } from "@storyforge/lorebooks";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getCharacterLorebooks,
  getLorebookDetail,
  getScenarioLorebooks,
  listLorebooks,
  loadScenarioLorebookAssignments,
} from "../../services/lorebook/lorebook.queries.js";
import { LorebookService } from "../../services/lorebook/lorebook.service.js";
import { getFullTimelineTurnCtx } from "../../services/timeline/timeline.queries.js";
import { publicProcedure, router } from "../index.js";

type ScenarioLorebookRow = Awaited<ReturnType<typeof getScenarioLorebooks>> extends Array<infer R>
  ? R
  : never;
type CharacterLorebookRow = Awaited<ReturnType<typeof getCharacterLorebooks>> extends Array<infer R>
  ? R
  : never;

const activationInputSchema = z.object({
  scenarioId: z.string().min(1),
  leafTurnId: z.string().min(1).optional(),
  debug: z.boolean().optional().default(false),
});

export const lorebooksRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/lorebooks",
        tags: ["lorebooks"],
        summary: "List lorebooks",
      },
    })
    .input(lorebookSearchQuerySchema)
    .output(lorebooksListResponseSchema)
    .query(async ({ input, ctx }) => {
      const rows = await listLorebooks(ctx.db, input);
      return { lorebooks: rows };
    }),

  search: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/lorebooks/search",
        tags: ["lorebooks"],
        summary: "Search lorebooks",
      },
    })
    .input(lorebookSearchQuerySchema)
    .output(lorebooksListResponseSchema)
    .query(async ({ input, ctx }) => {
      const rows = await listLorebooks(ctx.db, input);
      return { lorebooks: rows };
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/lorebooks/{id}",
        tags: ["lorebooks"],
        summary: "Get lorebook by ID",
      },
    })
    .input(lorebookIdSchema)
    .output(lorebookDetailSchema)
    .query(async ({ input, ctx }) => {
      const lorebook = await getLorebookDetail(ctx.db, input.id);
      if (!lorebook) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lorebook not found" });
      }

      return transformLorebookDetail({
        id: lorebook.id,
        name: lorebook.name,
        description: lorebook.description,
        entryCount: lorebook.entryCount,
        data: lorebook.data,
        createdAt: lorebook.createdAt,
        updatedAt: lorebook.updatedAt,
      });
    }),

  create: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/lorebooks",
        tags: ["lorebooks"],
        summary: "Create a lorebook",
      },
    })
    .input(createLorebookSchema)
    .output(lorebookDetailSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      const result = await svc.createLorebook({ data: input.data, source: input.source });
      return transformLorebookDetail({
        id: result.lorebook.id,
        name: result.lorebook.name,
        description: result.lorebook.description,
        entryCount: result.lorebook.entryCount,
        data: result.lorebook.data,
        createdAt: result.lorebook.createdAt,
        updatedAt: result.lorebook.updatedAt,
      });
    }),

  update: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/lorebooks/{id}",
        tags: ["lorebooks"],
        summary: "Update a lorebook",
      },
    })
    .input(updateLorebookSchema)
    .output(lorebookDetailSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      const updated = await svc.updateLorebook({ id: input.id, data: input.data });
      return transformLorebookDetail({
        id: updated.id,
        name: updated.name,
        description: updated.description,
        entryCount: updated.entryCount,
        data: updated.data,
        createdAt: updated.createdAt,
        updatedAt: updated.updatedAt,
      });
    }),

  delete: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/lorebooks/{id}",
        tags: ["lorebooks"],
        summary: "Delete a lorebook",
      },
    })
    .input(lorebookIdSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      const success = await svc.deleteLorebook(input.id);
      if (!success) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Lorebook not found" });
      }
    }),

  import: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/lorebooks/import",
        tags: ["lorebooks"],
        summary: "Import a lorebook from file",
      },
    })
    .input(importLorebookSchema)
    .output(lorebookDetailSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      const result = await svc.importLorebookFromDataUri(input.fileDataUri, "silly_v2", {
        filename: input.filename,
      });
      return transformLorebookDetail({
        id: result.lorebook.id,
        name: result.lorebook.name,
        description: result.lorebook.description,
        entryCount: result.lorebook.entryCount,
        data: result.lorebook.data,
        createdAt: result.lorebook.createdAt,
        updatedAt: result.lorebook.updatedAt,
      });
    }),

  importFromCharacter: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/lorebooks/from-character",
        tags: ["lorebooks"],
        summary: "Create a lorebook from a character's character book",
      },
    })
    .input(importLorebookFromCharacterSchema)
    .output(lorebookImportResultSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      const result = await svc.createLorebookFromCharacterCard({
        characterId: input.characterId,
        linkToCharacter: input.linkToCharacter,
      });

      return {
        lorebook: transformLorebookDetail({
          id: result.lorebook.id,
          name: result.lorebook.name,
          description: result.lorebook.description,
          entryCount: result.lorebook.entryCount,
          data: result.lorebook.data,
          createdAt: result.lorebook.createdAt,
          updatedAt: result.lorebook.updatedAt,
        }),
        created: result.created,
      };
    }),
});

export const scenarioLorebooksRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios/{id}/lorebooks",
        tags: ["scenarios"],
        summary: "List lorebooks assigned to a scenario",
      },
    })
    .input(scenarioIdSchema)
    .output(scenarioLorebooksResponseSchema)
    .query(async ({ input, ctx }) => {
      const rows = await getScenarioLorebooks(ctx.db, input.id);
      return {
        lorebooks: sortScenarioLorebooks(rows).map(transformScenarioLorebookItem),
      };
    }),

  assign: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/scenarios/{scenarioId}/lorebooks",
        tags: ["scenarios"],
        summary: "Assign a lorebook to a scenario",
      },
    })
    .input(assignScenarioManualLorebookSchema)
    .output(scenarioLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.addManualLorebookToScenario(input);
      const rows = await getScenarioLorebooks(ctx.db, input.scenarioId);
      return {
        lorebooks: sortScenarioLorebooks(rows).map(transformScenarioLorebookItem),
      };
    }),

  unassign: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/scenarios/{scenarioId}/lorebooks/{lorebookId}",
        tags: ["scenarios"],
        summary: "Remove a lorebook from a scenario",
      },
    })
    .input(unassignScenarioManualLorebookSchema)
    .output(scenarioLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.removeManualLorebookFromScenario(input);
      const rows = await getScenarioLorebooks(ctx.db, input.scenarioId);
      return {
        lorebooks: sortScenarioLorebooks(rows).map(transformScenarioLorebookItem),
      };
    }),

  setState: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/scenarios/{scenarioId}/lorebooks/state",
        tags: ["scenarios"],
        summary: "Enable or disable a lorebook assignment",
      },
    })
    .input(updateScenarioManualLorebookStateSchema)
    .output(scenarioLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.setManualLorebookState(input);
      const rows = await getScenarioLorebooks(ctx.db, input.scenarioId);
      return {
        lorebooks: sortScenarioLorebooks(rows).map(transformScenarioLorebookItem),
      };
    }),

  setCharacterOverride: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/scenarios/{scenarioId}/lorebooks/character",
        tags: ["scenarios"],
        summary: "Override a character-derived lorebook",
      },
    })
    .input(updateScenarioCharacterLorebookOverrideSchema)
    .output(scenarioLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.setCharacterLorebookOverride(input);
      const rows = await getScenarioLorebooks(ctx.db, input.scenarioId);
      return {
        lorebooks: sortScenarioLorebooks(rows).map(transformScenarioLorebookItem),
      };
    }),

  activated: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios/{scenarioId}/lorebooks/activated",
        tags: ["scenarios"],
        summary: "Preview activated lorebook entries",
      },
    })
    .input(activationInputSchema)
    .output(lorebookActivationDebugResponseSchema)
    .query(async ({ input, ctx }) => {
      const lorebooks = await loadScenarioLorebookAssignments(ctx.db, input.scenarioId);
      const turns = await getFullTimelineTurnCtx(ctx.db, input);

      if (input.debug) {
        return scanLorebooksDebug({ turns, lorebooks });
      }

      const result = scanLorebooks({ turns, lorebooks });
      return { result, trace: [] };
    }),

  activatedSummary: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/scenarios/{scenarioId}/lorebooks/activated/summary",
        tags: ["scenarios"],
        summary: "Activated lorebook entries (result only)",
      },
    })
    .input(activationInputSchema.omit({ debug: true }))
    .output(activatedLoreIndexSchema)
    .query(async ({ input, ctx }) => {
      const lorebooks = await loadScenarioLorebookAssignments(ctx.db, input.scenarioId);
      const turns = await getFullTimelineTurnCtx(ctx.db, input);

      return scanLorebooks({ turns, lorebooks });
    }),
});

export const characterLorebooksRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/characters/{id}/lorebooks",
        tags: ["characters"],
        summary: "List lorebooks linked to a character",
      },
    })
    .input(characterIdSchema)
    .output(characterLorebooksResponseSchema)
    .query(async ({ input, ctx }) => {
      const rows = await getCharacterLorebooks(ctx.db, input.id);
      return {
        lorebooks: rows.map(transformCharacterLorebookSummary),
      };
    }),

  link: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/characters/{characterId}/lorebooks",
        tags: ["characters"],
        summary: "Link a lorebook to a character",
      },
    })
    .input(linkCharacterLorebookSchema)
    .output(characterLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.linkLorebookToCharacter(input);
      const rows = await getCharacterLorebooks(ctx.db, input.characterId);
      return {
        lorebooks: rows.map(transformCharacterLorebookSummary),
      };
    }),

  unlink: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/characters/{characterId}/lorebooks/{lorebookId}",
        tags: ["characters"],
        summary: "Unlink a lorebook from a character",
      },
    })
    .input(unlinkCharacterLorebookSchema)
    .output(characterLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.unlinkLorebookFromCharacter(input);
      const rows = await getCharacterLorebooks(ctx.db, input.characterId);
      return {
        lorebooks: rows.map(transformCharacterLorebookSummary),
      };
    }),
});

type LorebookRecordLike = {
  id: string;
  name: string;
  description: string | null;
  entryCount: number;
  data: unknown;
  createdAt: Date;
  updatedAt: Date;
};

function transformLorebookDetail(row: LorebookRecordLike): LorebookDetail {
  const data = lorebookDataSchema.parse(row.data);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    entryCount: row.entryCount,
    data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function transformScenarioLorebookItem(row: ScenarioLorebookRow): ScenarioLorebookItem {
  if (row.kind === "manual") {
    return {
      kind: "manual",
      manualAssignmentId: row.manualAssignmentId,
      lorebookId: row.lorebookId,
      name: row.name,
      entryCount: row.entryCount,
      enabled: row.enabled,
      defaultEnabled: row.defaultEnabled,
    } satisfies ScenarioLorebookItem;
  }

  return {
    kind: "character",
    lorebookId: row.lorebookId,
    name: row.name,
    entryCount: row.entryCount,
    characterId: row.characterId,
    characterLorebookId: row.characterLorebookId,
    enabled: row.enabled,
    defaultEnabled: row.defaultEnabled,
    overrideEnabled: row.overrideEnabled,
  } satisfies ScenarioLorebookItem;
}

function transformCharacterLorebookSummary(row: CharacterLorebookRow): CharacterLinkedLorebook {
  return { ...row, characterLorebookId: row.characterLorebookId };
}

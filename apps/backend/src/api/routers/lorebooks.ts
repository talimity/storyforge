import {
  assignLorebookSchema,
  characterIdSchema,
  characterLorebooksResponseSchema,
  createLorebookSchema,
  importLorebookFromCharacterSchema,
  importLorebookSchema,
  type LorebookDetail,
  type LorebookSummary,
  linkCharacterLorebookSchema,
  lorebookDataSchema,
  lorebookDetailSchema,
  lorebookIdSchema,
  lorebookImportResultSchema,
  lorebookSearchQuerySchema,
  lorebooksListResponseSchema,
  reorderScenarioLorebooksSchema,
  scenarioIdSchema,
  type scenarioLorebookItemSchema,
  scenarioLorebooksResponseSchema,
  unlinkCharacterLorebookSchema,
  updateLorebookSchema,
} from "@storyforge/contracts";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  getCharacterLorebooks,
  getLorebookDetail,
  getScenarioLorebooks,
  listLorebooks,
} from "../../services/lorebook/lorebook.queries.js";
import { LorebookService } from "../../services/lorebook/lorebook.service.js";
import { publicProcedure, router } from "../index.js";

type LorebookSummaryRow = Awaited<ReturnType<typeof listLorebooks>> extends Array<infer R>
  ? R
  : never;
type ScenarioLorebookRow = Awaited<ReturnType<typeof getScenarioLorebooks>> extends Array<infer R>
  ? R
  : never;
type CharacterLorebookRow = Awaited<ReturnType<typeof getCharacterLorebooks>> extends Array<infer R>
  ? R
  : never;

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
      return {
        lorebooks: rows.map(transformLorebookSummary),
      };
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
      return {
        lorebooks: rows.map(transformLorebookSummary),
      };
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
        lorebooks: rows.map(transformScenarioLorebookItem),
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
    .input(assignLorebookSchema)
    .output(scenarioLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.assignToScenario(input);
      const rows = await getScenarioLorebooks(ctx.db, input.scenarioId);
      return {
        lorebooks: rows.map(transformScenarioLorebookItem),
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
    .input(assignLorebookSchema)
    .output(scenarioLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.unassignFromScenario(input);
      const rows = await getScenarioLorebooks(ctx.db, input.scenarioId);
      return {
        lorebooks: rows.map(transformScenarioLorebookItem),
      };
    }),

  reorder: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/scenarios/{scenarioId}/lorebooks/reorder",
        tags: ["scenarios"],
        summary: "Reorder scenario lorebooks",
      },
    })
    .input(reorderScenarioLorebooksSchema)
    .output(scenarioLorebooksResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const svc = new LorebookService(ctx.db);
      await svc.reorderScenarioLorebooks(input.scenarioId, input.orders);
      const rows = await getScenarioLorebooks(ctx.db, input.scenarioId);
      return {
        lorebooks: rows.map(transformScenarioLorebookItem),
      };
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

function transformLorebookSummary(row: LorebookSummaryRow): LorebookSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    entryCount: row.entryCount,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

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
    description: row.description ?? null,
    entryCount: row.entryCount,
    data,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

type ScenarioLorebookItem = z.infer<typeof scenarioLorebookItemSchema>;

function transformScenarioLorebookItem(row: ScenarioLorebookRow): ScenarioLorebookItem {
  return {
    id: row.id,
    name: row.name,
    entryCount: row.entryCount,
    enabled: row.enabled,
    orderIndex: row.orderIndex,
  };
}

function transformCharacterLorebookSummary(row: CharacterLorebookRow): LorebookSummary {
  return transformLorebookSummary(row);
}

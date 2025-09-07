import {
  createTemplateSchema,
  duplicateTemplateSchema,
  exportTemplateResponseSchema,
  importTemplateSchema,
  listTemplatesQuerySchema,
  templateDetailResponseSchema,
  templateIdSchema,
  templateOperationResponseSchema,
  templatesListResponseSchema,
  updateTemplateSchema,
} from "@storyforge/schemas";
import { z } from "zod";
import { getTemplateById, listTemplates } from "../../services/template/template.queries.js";
import { TemplateService } from "../../services/template/template.service.js";
import { publicProcedure, router } from "../index.js";

export const templatesRouter = router({
  list: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/templates",
        tags: ["templates"],
        summary: "List prompt templates",
      },
    })
    .input(listTemplatesQuerySchema)
    .output(templatesListResponseSchema)
    .query(async ({ input, ctx }) => {
      const templates = await listTemplates(ctx.db, input);
      return { templates };
    }),

  getById: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/templates/{id}",
        tags: ["templates"],
        summary: "Get prompt template by ID",
      },
    })
    .input(templateIdSchema)
    .output(templateDetailResponseSchema)
    .query(async ({ input, ctx }) => {
      return await getTemplateById(ctx.db, input.id);
    }),

  create: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/templates",
        tags: ["templates"],
        summary: "Create a new prompt template",
      },
    })
    .input(createTemplateSchema)
    .output(templateOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TemplateService(ctx.db);
      return await service.createTemplate(input);
    }),

  update: publicProcedure
    .meta({
      openapi: {
        method: "PUT",
        path: "/api/templates/{id}",
        tags: ["templates"],
        summary: "Update a prompt template",
      },
    })
    .input(z.object({ id: z.string(), data: updateTemplateSchema }))
    .output(templateOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TemplateService(ctx.db);
      return await service.updateTemplate(input.id, input.data);
    }),

  delete: publicProcedure
    .meta({
      openapi: {
        method: "DELETE",
        path: "/api/templates/{id}",
        tags: ["templates"],
        summary: "Delete a prompt template",
      },
    })
    .input(templateIdSchema)
    .output(z.void())
    .mutation(async ({ input, ctx }) => {
      const service = new TemplateService(ctx.db);
      await service.deleteTemplate(input.id);
    }),

  duplicate: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/templates/{id}/duplicate",
        tags: ["templates"],
        summary: "Duplicate a prompt template",
      },
    })
    .input(duplicateTemplateSchema)
    .output(templateOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TemplateService(ctx.db);
      return await service.duplicateTemplate(input.id, input.name);
    }),

  import: publicProcedure
    .meta({
      openapi: {
        method: "POST",
        path: "/api/templates/import",
        tags: ["templates"],
        summary: "Import a prompt template from JSON",
      },
    })
    .input(importTemplateSchema)
    .output(templateOperationResponseSchema)
    .mutation(async ({ input, ctx }) => {
      const service = new TemplateService(ctx.db);
      return await service.importTemplate(input.template);
    }),

  export: publicProcedure
    .meta({
      openapi: {
        method: "GET",
        path: "/api/templates/{id}/export",
        tags: ["templates"],
        summary: "Export a prompt template as JSON",
      },
    })
    .input(templateIdSchema)
    .output(exportTemplateResponseSchema)
    .query(async ({ input, ctx }) => {
      const { createdAt, updatedAt, ...exportTemplate } = await getTemplateById(ctx.db, input.id);

      return {
        template: exportTemplate,
        exportedAt: new Date(),
      };
    }),
});

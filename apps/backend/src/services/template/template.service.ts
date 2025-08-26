import {
  type NewPromptTemplate,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import {
  compileTemplate,
  type PromptTemplate as SpecPromptTemplate,
} from "@storyforge/prompt-renderer";
import { eq } from "drizzle-orm";
import { ServiceError } from "@/service-error";
import { fromDbPromptTemplate } from "@/services/template/utils/from-db-prompt-template";

// Use the prompt-renderer types for validation, then convert to database format
interface CreateTemplateData
  extends Omit<SpecPromptTemplate, "id" | "version"> {}

interface UpdateTemplateData
  extends Partial<Omit<SpecPromptTemplate, "id" | "version">> {}

export class TemplateService {
  constructor(private db: SqliteDatabase) {}

  async createTemplate(data: CreateTemplateData, outerTx?: SqliteTransaction) {
    // Compile the template to validate its structure
    const templateForValidation: SpecPromptTemplate = {
      id: "temp-id-for-validation",
      task: data.task,
      name: data.name,
      version: 1,
      layout: data.layout,
      slots: data.slots,
      responseFormat: data.responseFormat,
      responseTransforms: data.responseTransforms,
    };

    try {
      compileTemplate(templateForValidation);
    } catch (error) {
      throw new ServiceError("InvalidInput", {
        message: `Template validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    const operation = async (tx: SqliteTransaction) => {
      // Convert from prompt-renderer types to database JSON types
      const dbData = {
        name: data.name,
        task: data.task,
        version: 1,
        layout: data.layout,
        slots: data.slots,
        responseFormat: data.responseFormat ? data.responseFormat : null,
        responseTransforms: data.responseTransforms
          ? data.responseTransforms
          : null,
      };

      const [dbTemplate] = await tx
        .insert(schema.promptTemplates)
        .values(dbData)
        .returning()
        .all();

      return {
        ...fromDbPromptTemplate(dbTemplate),
        createdAt: dbTemplate.createdAt,
        updatedAt: dbTemplate.updatedAt,
      };
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  async updateTemplate(
    id: string,
    data: UpdateTemplateData,
    outerTx?: SqliteTransaction
  ) {
    const operation = async (tx: SqliteTransaction) => {
      const existing = await tx.query.promptTemplates.findFirst({
        where: { id },
      });

      if (!existing) {
        throw new ServiceError("NotFound", {
          message: `Template with id ${id} not found`,
        });
      }

      const existingAsSpec = fromDbPromptTemplate(existing);

      // Create updated template for validation (convert database types to prompt-renderer types)
      const updatedTemplate: SpecPromptTemplate = {
        id: existingAsSpec.id,
        task: data.task ?? existingAsSpec.task,
        name: data.name ?? existingAsSpec.name,
        version: existingAsSpec.version,
        layout: data.layout ?? existingAsSpec.layout,
        slots: data.slots ?? existingAsSpec.slots,
        responseFormat: data.responseFormat ?? existingAsSpec.responseFormat,
        responseTransforms:
          data.responseTransforms ?? existingAsSpec.responseTransforms,
      };

      try {
        compileTemplate(updatedTemplate);
      } catch (error) {
        throw new ServiceError("InvalidInput", {
          message: `Template validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      // Convert from prompt-renderer types to database JSON types for update
      const updateData: Partial<NewPromptTemplate> = {
        version: existingAsSpec.version,
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.task !== undefined) updateData.task = data.task;
      if (data.layout !== undefined) updateData.layout = data.layout;
      if (data.slots !== undefined) updateData.slots = data.slots;
      if (data.responseFormat !== undefined)
        updateData.responseFormat = data.responseFormat
          ? data.responseFormat
          : null;
      if (data.responseTransforms !== undefined)
        updateData.responseTransforms = data.responseTransforms
          ? data.responseTransforms
          : null;

      const [dbTemplate] = await tx
        .update(schema.promptTemplates)
        .set(updateData)
        .where(eq(schema.promptTemplates.id, id))
        .returning()
        .all();

      return {
        ...fromDbPromptTemplate(dbTemplate),
        createdAt: dbTemplate.createdAt,
        updatedAt: dbTemplate.updatedAt,
      };
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  async deleteTemplate(id: string, outerTx?: SqliteTransaction) {
    const operation = async (tx: SqliteTransaction) => {
      const existing = await tx.query.promptTemplates.findFirst({
        where: { id },
      });

      if (!existing) {
        throw new ServiceError("NotFound", {
          message: `Template with id ${id} not found`,
        });
      }

      await tx
        .delete(schema.promptTemplates)
        .where(eq(schema.promptTemplates.id, id))
        .execute();

      return { success: true };
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  async duplicateTemplate(
    id: string,
    newName: string,
    outerTx?: SqliteTransaction
  ) {
    const operation = async (tx: SqliteTransaction) => {
      const existing = await tx.query.promptTemplates.findFirst({
        where: { id },
      });

      if (!existing) {
        throw new ServiceError("NotFound", {
          message: `Template with id ${id} not found`,
        });
      }

      const [dbTemplate] = await tx
        .insert(schema.promptTemplates)
        .values({
          name: newName,
          task: existing.task,
          version: existing.version,
          layout: existing.layout,
          slots: existing.slots,
          responseFormat: existing.responseFormat,
          responseTransforms: existing.responseTransforms,
        })
        .returning()
        .all();

      return {
        ...fromDbPromptTemplate(dbTemplate),
        createdAt: dbTemplate.createdAt,
        updatedAt: dbTemplate.updatedAt,
      };
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  async importTemplate(
    templateData: Omit<SpecPromptTemplate, "id" | "version">,
    outerTx?: SqliteTransaction
  ) {
    const templateForValidation: SpecPromptTemplate = {
      id: "temp-id-for-validation",
      version: 1,
      ...templateData,
    };

    try {
      compileTemplate(templateForValidation);
    } catch (error) {
      throw new ServiceError("InvalidInput", {
        message: `Invalid template: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    return this.createTemplate(templateData, outerTx);
  }
}

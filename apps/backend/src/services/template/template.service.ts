import {
  type NewPromptTemplate,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import {
  compileTemplate,
  type PromptTemplate as SpecPromptTemplate,
} from "@storyforge/prompt-rendering";
import { eq } from "drizzle-orm";
import { ServiceError } from "@/service-error";
import { fromDbPromptTemplate } from "@/services/template/utils/from-db-prompt-template";

// Use the prompt-rendering types for validation, then convert to database format
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
      description: data.description,
      version: 1,
      layout: data.layout,
      slots: data.slots,
    };

    try {
      compileTemplate(templateForValidation);
    } catch (error) {
      throw new ServiceError("InvalidInput", {
        message: `Template validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }

    const operation = async (tx: SqliteTransaction) => {
      // Convert from prompt-rendering types to database JSON types
      const dbData = {
        task: data.task,
        name: data.name,
        description: data.description,
        version: 1,
        layout: data.layout,
        slots: data.slots,
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

      // Create updated template for validation (convert database types to prompt-rendering types)
      const updatedTemplate: SpecPromptTemplate = {
        id: existingAsSpec.id,
        task: existingAsSpec.task,
        name: data.name ?? existingAsSpec.name,
        description: data.description ?? existingAsSpec.description,
        version: existingAsSpec.version,
        layout: data.layout ?? existingAsSpec.layout,
        slots: data.slots ?? existingAsSpec.slots,
      };

      try {
        compileTemplate(updatedTemplate);
      } catch (error) {
        throw new ServiceError("InvalidInput", {
          message: `Template validation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
        });
      }

      // Convert from prompt-rendering types to database JSON types for update
      const updateData: Partial<NewPromptTemplate> = {
        version: existingAsSpec.version,
        task: existingAsSpec.task,
      };

      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined)
        updateData.description = data.description;
      if (data.layout !== undefined) updateData.layout = data.layout;
      if (data.slots !== undefined) updateData.slots = data.slots;

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
          description: existing.description,
          task: existing.task,
          version: existing.version,
          layout: existing.layout,
          slots: existing.slots,
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

import {
  type NewPromptTemplate,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import type { UnboundTemplate } from "@storyforge/prompt-rendering";
import { eq } from "drizzle-orm";
import { ServiceError } from "@/service-error";
import {
  fromDbPromptTemplate,
  tryCompileUnboundTemplate,
} from "@/services/template/utils/marshalling";

type CreateTemplateData = Omit<UnboundTemplate, "id" | "version">;
type UpdateTemplateData = Partial<Omit<UnboundTemplate, "id" | "version">>;

export class TemplateService {
  constructor(private db: SqliteDatabase) {}

  async createTemplate(data: CreateTemplateData, outerTx?: SqliteTransaction) {
    const templateForValidation: UnboundTemplate = {
      id: "temp-id-for-validation",
      task: data.task,
      name: data.name,
      description: data.description,
      version: 1,
      layout: data.layout,
      slots: data.slots,
    };

    tryCompileUnboundTemplate(templateForValidation);

    const operation = async (tx: SqliteTransaction) => {
      // Convert from prompt-rendering types to database JSON types
      const dbData = {
        kind: data.task,
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

      const existingUnboundTemplate = fromDbPromptTemplate(existing);

      // Create updated template for validation (convert database types to prompt-rendering types)
      const newUnboundTemplate: UnboundTemplate = {
        id: existingUnboundTemplate.id,
        task: existingUnboundTemplate.task,
        name: data.name ?? existingUnboundTemplate.name,
        description: data.description ?? existingUnboundTemplate.description,
        version: existingUnboundTemplate.version,
        layout: data.layout ?? existingUnboundTemplate.layout,
        slots: data.slots ?? existingUnboundTemplate.slots,
      };

      // Validate the updated template structure
      tryCompileUnboundTemplate(newUnboundTemplate);

      // Convert from prompt-rendering types to database JSON types for update
      const updateData: Partial<NewPromptTemplate> = {
        version: existingUnboundTemplate.version,
        kind: existingUnboundTemplate.task,
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
          kind: existing.kind,
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
    templateData: Omit<UnboundTemplate, "id" | "version">,
    outerTx?: SqliteTransaction
  ) {
    // May eventually need some dedicated import logic (e.g., to merge with existing templates)
    // but for now just create a new template
    return this.createTemplate(templateData, outerTx);
  }
}

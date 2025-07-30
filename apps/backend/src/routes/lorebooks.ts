import { FastifyInstance } from "fastify";
import { lorebookRepository } from "../repositories";
import {
  Lorebook,
  LorebookEntry as SharedLorebookEntry,
} from "@storyforge/shared";

interface GetLorebookParams {
  id: string;
}

interface EntryParams {
  lorebookId: string;
  entryId: string;
}

export async function lorebooksRoutes(fastify: FastifyInstance) {
  fastify.get("/api/lorebooks", async () => {
    try {
      const lorebooks = await lorebookRepository.findAllWithEntries();

      const transformedLorebooks: Lorebook[] = lorebooks.map((lorebook) => ({
        id: lorebook.id,
        name: lorebook.name,
        description: lorebook.description,
        entries: lorebook.entries.map((entry) => ({
          id: entry.id,
          trigger: entry.triggers,
          content: entry.content,
          enabled: entry.enabled,
        })),
      }));

      return { lorebooks: transformedLorebooks };
    } catch (error) {
      fastify.log.error(error);
      throw new Error("Failed to fetch lorebooks");
    }
  });

  fastify.get<{ Params: GetLorebookParams }>(
    "/api/lorebooks/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const lorebook = await lorebookRepository.findByIdWithEntries(id);

        if (!lorebook) {
          return reply.code(404).send({ error: "Lorebook not found" });
        }

        const transformedLorebook: Lorebook = {
          id: lorebook.id,
          name: lorebook.name,
          description: lorebook.description,
          entries: lorebook.entries.map((entry) => ({
            id: entry.id,
            trigger: entry.triggers,
            content: entry.content,
            enabled: entry.enabled,
          })),
        };

        return transformedLorebook;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to fetch lorebook" });
      }
    }
  );

  fastify.post<{ Body: Omit<Lorebook, "id"> }>(
    "/api/lorebooks",
    async (request, reply) => {
      try {
        const { entries, ...lorebookData } = request.body;

        const newLorebook = await lorebookRepository.createWithEntries(
          {
            name: lorebookData.name,
            description: lorebookData.description,
          },
          entries?.map((entry, index) => ({
            triggers: entry.trigger,
            content: entry.content,
            enabled: entry.enabled,
            orderIndex: index,
          })) || []
        );

        return reply.code(201).send(newLorebook);
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to create lorebook" });
      }
    }
  );

  fastify.put<{ Params: GetLorebookParams; Body: Partial<Lorebook> }>(
    "/api/lorebooks/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const { entries, ...lorebookData } = request.body;

        const updateData: Parameters<typeof lorebookRepository.update>[1] = {};

        if (lorebookData.name !== undefined) {
          updateData.name = lorebookData.name;
        }
        if (lorebookData.description !== undefined) {
          updateData.description = lorebookData.description;
        }

        const updatedLorebook = await lorebookRepository.update(id, updateData);

        if (!updatedLorebook) {
          return reply.code(404).send({ error: "Lorebook not found" });
        }

        return updatedLorebook;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to update lorebook" });
      }
    }
  );

  fastify.post<{
    Params: GetLorebookParams;
    Body: Omit<SharedLorebookEntry, "id">;
  }>("/api/lorebooks/:id/entries", async (request, reply) => {
    const { id } = request.params;

    try {
      const lorebook = await lorebookRepository.exists(id);
      if (!lorebook) {
        return reply.code(404).send({ error: "Lorebook not found" });
      }

      const newEntry = await lorebookRepository.addEntry(id, {
        triggers: request.body.trigger,
        content: request.body.content,
        enabled: request.body.enabled,
      });

      return reply.code(201).send(newEntry);
    } catch (error) {
      fastify.log.error(error);
      return reply.code(500).send({ error: "Failed to add entry" });
    }
  });

  fastify.put<{ Params: EntryParams; Body: Partial<SharedLorebookEntry> }>(
    "/api/lorebooks/:lorebookId/entries/:entryId",
    async (request, reply) => {
      const { entryId } = request.params;

      try {
        const updateData: Parameters<typeof lorebookRepository.updateEntry>[1] =
          {};

        if (request.body.trigger !== undefined) {
          updateData.triggers = request.body.trigger;
        }
        if (request.body.content !== undefined) {
          updateData.content = request.body.content;
        }
        if (request.body.enabled !== undefined) {
          updateData.enabled = request.body.enabled;
        }

        const updatedEntry = await lorebookRepository.updateEntry(
          entryId,
          updateData
        );

        if (!updatedEntry) {
          return reply.code(404).send({ error: "Entry not found" });
        }

        return updatedEntry;
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to update entry" });
      }
    }
  );

  fastify.delete<{ Params: EntryParams }>(
    "/api/lorebooks/:lorebookId/entries/:entryId",
    async (request, reply) => {
      const { entryId } = request.params;

      try {
        const deleted = await lorebookRepository.deleteEntry(entryId);

        if (!deleted) {
          return reply.code(404).send({ error: "Entry not found" });
        }

        return reply.code(204).send();
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to delete entry" });
      }
    }
  );

  fastify.delete<{ Params: GetLorebookParams }>(
    "/api/lorebooks/:id",
    async (request, reply) => {
      const { id } = request.params;

      try {
        const deleted = await lorebookRepository.delete(id);

        if (!deleted) {
          return reply.code(404).send({ error: "Lorebook not found" });
        }

        return reply.code(204).send();
      } catch (error) {
        fastify.log.error(error);
        return reply.code(500).send({ error: "Failed to delete lorebook" });
      }
    }
  );
}

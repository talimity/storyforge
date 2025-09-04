import {
  type NewScenario,
  type Scenario,
  type ScenarioParticipant,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import { eq, inArray, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";

interface CreateScenarioData extends NewScenario {
  characterIds?: string[];
  userProxyCharacterId?: string;
}

interface UpdateScenarioData extends Partial<NewScenario> {
  participants?: Array<{
    characterId: string;
    role?: string;
    isUserProxy?: boolean;
  }>;
}

export class ScenarioService {
  constructor(private db: SqliteDatabase) {}

  async createScenario(data: CreateScenarioData, outerTx?: SqliteTransaction) {
    const { characterIds = [], userProxyCharacterId, ...scenarioData } = data;

    if (characterIds.length < 2) {
      throw new ServiceError("InvalidInput", {
        message: "A scenario must have at least 2 characters.",
      });
    }

    if (userProxyCharacterId && !characterIds.includes(userProxyCharacterId)) {
      throw new ServiceError("InvalidInput", {
        message:
          "User proxy character must be one of the scenario participants.",
      });
    }

    const operation = async (tx: SqliteTransaction) => {
      const [sc] = await tx
        .insert(schema.scenarios)
        .values(scenarioData)
        .returning()
        .all();

      await tx
        .insert(schema.chapters)
        .values({ scenarioId: sc.id, name: "Chapter 1", index: 0 })
        .execute();

      await tx
        .insert(schema.scenarioParticipants)
        .values({
          scenarioId: sc.id,
          characterId: null,
          type: "narrator",
          role: "Narrator",
          orderIndex: 999,
        })
        .execute();

      await tx
        .insert(schema.scenarioParticipants)
        .values(
          characterIds.map((characterId, orderIndex) => ({
            scenarioId: sc.id,
            characterId,
            orderIndex,
            isUserProxy: characterId === userProxyCharacterId,
          }))
        )
        .execute();

      return sc;
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  async updateScenario(
    id: string,
    data: UpdateScenarioData,
    outerTx?: SqliteTransaction
  ) {
    const { participants, ...scenarioData } = data;

    const operation = async (tx: SqliteTransaction) => {
      let updatedScenario: Scenario | undefined;

      // Only update scenario fields if there are any to update
      if (Object.keys(scenarioData).length > 0) {
        const result = await tx
          .update(schema.scenarios)
          .set(scenarioData)
          .where(eq(schema.scenarios.id, id))
          .returning();
        updatedScenario = result[0];
      } else {
        // If only updating participants, fetch the existing scenario
        updatedScenario = await tx
          .select()
          .from(schema.scenarios)
          .where(eq(schema.scenarios.id, id))
          .get();
      }

      if (!updatedScenario) {
        return null;
      }

      // Handle participant updates if provided
      if (participants) {
        await this.reconcileParticipants(tx, id, participants);
      }

      return updatedScenario;
    };

    return outerTx ? operation(outerTx) : this.db.transaction(operation);
  }

  private async reconcileParticipants(
    tx: SqliteTransaction,
    scenarioId: string,
    inputParticipants: UpdateScenarioData["participants"]
  ) {
    if (!inputParticipants) return;

    // Validate minimum participants
    if (inputParticipants.length < 2) {
      throw new ServiceError("InvalidInput", {
        message: "A scenario must have at least 2 characters.",
      });
    }

    // Ensure only one user proxy
    const userProxyCount = inputParticipants.filter(
      (p) => p.isUserProxy
    ).length;
    if (userProxyCount > 1) {
      throw new ServiceError("InvalidInput", {
        message: "Only one participant can be designated as the user proxy.",
      });
    }

    // Load existing character participants (exclude narrator)
    const existing = await tx
      .select()
      .from(schema.scenarioParticipants)
      .where(eq(schema.scenarioParticipants.scenarioId, scenarioId))
      .all()
      .then((ps) => ps.filter((p) => p.type === "character" && p.characterId));

    // Build maps for comparison (we already filtered to ensure characterId exists)
    const existingById = new Map(
      existing.map((p) => [p.characterId as string, p])
    );
    const inputById = new Map(inputParticipants.map((p) => [p.characterId, p]));

    // Compute operations
    const toAdd = inputParticipants.filter(
      (p) => !existingById.has(p.characterId)
    );
    const toRemove = existing.filter((p) => {
      // We know characterId exists because we filtered earlier
      const charId = p.characterId as string;
      return !inputById.has(charId);
    });
    const toUpdate = existing.filter((p) => {
      // We know characterId exists because we filtered earlier
      const charId = p.characterId as string;
      const input = inputById.get(charId);
      if (!input) return false;
      return p.role !== input.role || p.isUserProxy !== input.isUserProxy;
    });

    // Execute removals (hard delete if no turns exist)
    if (toRemove.length > 0) {
      // Check if any participants to remove have turns
      const participantsWithTurns = await tx
        .select({ participantId: schema.turns.authorParticipantId })
        .from(schema.turns)
        .where(
          inArray(
            schema.turns.authorParticipantId,
            toRemove.map((p) => p.id)
          )
        )
        .groupBy(schema.turns.authorParticipantId)
        .all();

      const participantIdsWithTurns = new Set(
        participantsWithTurns.map((p) => p.participantId)
      );

      // Check if any participant has turns
      const participantsToRemoveWithTurns = toRemove.filter((p) =>
        participantIdsWithTurns.has(p.id)
      );

      if (participantsToRemoveWithTurns.length > 0) {
        const names = participantsToRemoveWithTurns
          .map((p) => `Character ID: ${p.characterId}`)
          .join(", ");
        throw new ServiceError("Conflict", {
          message: `Cannot remove participants with existing turns: ${names}. Please delete their turns first.`,
        });
      }

      // Hard delete participants without turns
      await tx.delete(schema.scenarioParticipants).where(
        inArray(
          schema.scenarioParticipants.id,
          toRemove.map((p) => p.id)
        )
      );
    }

    // Execute additions
    if (toAdd.length > 0) {
      // Get max order index for new participants
      const maxOrderResult = await tx
        .select({
          maxOrder: sql<number>`MAX(${schema.scenarioParticipants.orderIndex})`,
        })
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenarioId))
        .get();

      let nextOrder = (maxOrderResult?.maxOrder ?? -1) + 1;

      await tx.insert(schema.scenarioParticipants).values(
        toAdd.map((p) => ({
          scenarioId,
          characterId: p.characterId,
          role: p.role,
          isUserProxy: p.isUserProxy ?? false,
          orderIndex: nextOrder++,
          type: "character" as const,
        }))
      );
    }

    // Execute updates
    for (const existing of toUpdate) {
      // We know characterId exists and input exists from toUpdate filter
      const charId = existing.characterId as string;
      const input = inputById.get(charId);
      if (!input) continue; // This shouldn't happen but handle it gracefully

      await tx
        .update(schema.scenarioParticipants)
        .set({
          role: input.role,
          isUserProxy: input.isUserProxy ?? false,
        })
        .where(eq(schema.scenarioParticipants.id, existing.id));
    }
  }

  async deleteScenario(id: string) {
    const result = await this.db
      .delete(schema.scenarios)
      .where(eq(schema.scenarios.id, id))
      .returning();

    return result.length > 0;
  }

  /** Adds a participant to an existing scenario. */
  async addParticipant(
    args: {
      scenarioId: string;
      characterId: ScenarioParticipant["characterId"];
      type: ScenarioParticipant["type"];
      role?: ScenarioParticipant["role"];
    },
    outerTx?: SqliteTransaction
  ) {
    const { scenarioId, characterId, type = "character", role } = args;
    const work = async (tx: SqliteTransaction) => {
      const sc = await tx
        .select()
        .from(schema.scenarios)
        .where(eq(schema.scenarios.id, scenarioId))
        .get();
      if (!sc) {
        throw new ServiceError("NotFound", {
          message: `Scenario with ID ${scenarioId} not found.`,
        });
      }

      const ps = await tx
        .select()
        .from(schema.scenarioParticipants)
        .where(eq(schema.scenarioParticipants.scenarioId, scenarioId));

      const hasNarrator = ps.some(
        (p) => p.type === "narrator" && p.characterId === null
      );
      if (type === "narrator" && hasNarrator) {
        throw new ServiceError("Conflict", {
          message: "Scenario can only have one narrator.",
        });
      }

      const maxOrderIndex = ps.reduce(
        (max, p) => Math.max(max, p.orderIndex ?? 0),
        -1
      );

      const result = await tx
        .insert(schema.scenarioParticipants)
        .values({
          scenarioId,
          characterId,
          type,
          role,
          orderIndex: type === "narrator" ? 999 : maxOrderIndex + 1,
        })
        .returning();

      return result[0];
    };
    return outerTx ? work(outerTx) : this.db.transaction(work);
  }
}

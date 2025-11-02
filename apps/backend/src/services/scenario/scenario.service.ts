import type {
  CreateScenarioInput,
  ScenarioLorebookAssignmentInput,
  ScenarioParticipantInput,
  UpdateScenarioInput,
} from "@storyforge/contracts";
import {
  type Scenario,
  type ScenarioParticipant as ScenarioParticipantRow,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import { assertDefined } from "@storyforge/utils";
import { and, eq, inArray, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { withTransaction } from "../../transaction-utils.js";
import { LorebookService } from "../lorebook/lorebook.service.js";

export class ScenarioService {
  private readonly lorebookService: LorebookService;

  constructor(private db: SqliteDatabase) {
    this.lorebookService = new LorebookService(db);
  }

  async createScenario(input: CreateScenarioInput, outerTx?: SqliteTransaction) {
    const { participants, lorebooks, ...scenarioData } = input;

    this.assertValidParticipants(participants);

    const operation = async (tx: SqliteTransaction) => {
      const [sc] = await tx.insert(schema.scenarios).values(scenarioData).returning().all();

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

      const participantRows = await tx
        .insert(schema.scenarioParticipants)
        .values(
          participants.map((participant, orderIndex) => ({
            scenarioId: sc.id,
            characterId: participant.characterId,
            role: participant.role,
            isUserProxy: participant.isUserProxy ?? false,
            orderIndex,
            type: "character" as const,
            colorOverride: participant.colorOverride,
          }))
        )
        .returning({
          id: schema.scenarioParticipants.id,
          characterId: schema.scenarioParticipants.characterId,
        });

      const participantSnapshots = participantRows.map((row) => {
        assertDefined(row.characterId);
        return { participantId: row.id, characterId: row.characterId };
      });

      const assignments = await this.composeScenarioLorebookAssignments(
        tx,
        participantSnapshots,
        lorebooks ?? []
      );

      await this.lorebookService.replaceScenarioLorebookSettings(sc.id, assignments, tx);

      return sc;
    };

    return withTransaction(this.db, outerTx, operation);
  }

  async updateScenario(
    id: string,
    data: Partial<Omit<UpdateScenarioInput, "id">>,
    outerTx?: SqliteTransaction
  ) {
    const { participants, lorebooks, ...scenarioData } = data;

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

      if (participants || lorebooks) {
        const participantSnapshots = await this.getParticipantSnapshots(tx, id);
        const requestedAssignments = lorebooks ?? (await this.getExistingScenarioLorebooks(tx, id));
        const assignments = await this.composeScenarioLorebookAssignments(
          tx,
          participantSnapshots,
          requestedAssignments
        );
        await this.lorebookService.replaceScenarioLorebookSettings(id, assignments, tx);
      }

      return updatedScenario;
    };

    return withTransaction(this.db, outerTx, operation);
  }

  private async reconcileParticipants(
    tx: SqliteTransaction,
    scenarioId: string,
    inputParticipants: readonly ScenarioParticipantInput[]
  ) {
    if (!inputParticipants) return;

    this.assertValidParticipants(inputParticipants);

    // Ensure only one user proxy
    const userProxyCount = inputParticipants.filter((p) => p.isUserProxy).length;
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

    // Build maps for comparison
    const existingById = new Map(
      existing.map((p) => {
        assertDefined(p.characterId);
        return [p.characterId, p];
      })
    );
    const inputById = new Map(inputParticipants.map((p) => [p.characterId, p]));

    // Compute operations
    const toAdd = inputParticipants.filter((p) => !existingById.has(p.characterId));
    const toRemove = existing.filter((p) => {
      assertDefined(p.characterId);
      return !inputById.has(p.characterId);
    });
    const toUpdate = existing.filter((p) => {
      assertDefined(p.characterId);
      const input = inputById.get(p.characterId);
      if (!input) return false;

      const { role: newRole, isUserProxy: newProxy, colorOverride: newColor } = input;
      const roleChanged = newRole !== undefined && newRole !== p.role;
      const proxyChanged = newProxy !== p.isUserProxy;
      const colorChange = newColor !== undefined && newColor !== p.colorOverride;

      return roleChanged || proxyChanged || colorChange;
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

      const participantIdsWithTurns = new Set(participantsWithTurns.map((p) => p.participantId));

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
          colorOverride: p.colorOverride,
        }))
      );
    }

    // Execute updates
    for (const existing of toUpdate) {
      assertDefined(existing.characterId);
      const input = inputById.get(existing.characterId);
      if (!input) continue; // This shouldn't happen but handle it gracefully

      await tx
        .update(schema.scenarioParticipants)
        .set(input)
        .where(eq(schema.scenarioParticipants.id, existing.id));
    }
  }

  private assertValidParticipants(participants: readonly ScenarioParticipantInput[]) {
    if (!participants || participants.length < 2) {
      throw new ServiceError("InvalidInput", {
        message: "A scenario must have at least 2 characters.",
      });
    }

    const proxyCount = participants.filter((p) => p.isUserProxy).length;
    if (proxyCount > 1) {
      throw new ServiceError("InvalidInput", {
        message: "Only one participant may be marked as the user proxy.",
      });
    }
  }

  private async getParticipantSnapshots(
    tx: SqliteTransaction,
    scenarioId: string
  ): Promise<Array<{ participantId: string; characterId: string }>> {
    const rows = await tx
      .select({
        id: schema.scenarioParticipants.id,
        characterId: schema.scenarioParticipants.characterId,
      })
      .from(schema.scenarioParticipants)
      .where(
        and(
          eq(schema.scenarioParticipants.scenarioId, scenarioId),
          eq(schema.scenarioParticipants.type, "character"),
          eq(schema.scenarioParticipants.status, "active")
        )
      )
      .all();

    return rows
      .filter((row) => row.characterId)
      .map((row) => {
        assertDefined(row.characterId);
        return { participantId: row.id, characterId: row.characterId };
      });
  }

  private async getExistingScenarioLorebooks(
    tx: SqliteTransaction,
    scenarioId: string
  ): Promise<ScenarioLorebookAssignmentInput[]> {
    const manualAssignments = await tx
      .select({
        lorebookId: schema.scenarioLorebooks.lorebookId,
        enabled: schema.scenarioLorebooks.enabled,
      })
      .from(schema.scenarioLorebooks)
      .where(eq(schema.scenarioLorebooks.scenarioId, scenarioId));

    const characterOverrides = await tx
      .select({
        characterLorebookId: schema.scenarioCharacterLorebookOverrides.characterLorebookId,
        enabled: schema.scenarioCharacterLorebookOverrides.enabled,
      })
      .from(schema.scenarioCharacterLorebookOverrides)
      .where(eq(schema.scenarioCharacterLorebookOverrides.scenarioId, scenarioId));

    const assignments: ScenarioLorebookAssignmentInput[] = [];

    for (const manual of manualAssignments) {
      assignments.push({
        kind: "manual",
        lorebookId: manual.lorebookId,
        enabled: Boolean(manual.enabled),
      });
    }

    for (const override of characterOverrides) {
      assignments.push({
        kind: "character",
        characterLorebookId: override.characterLorebookId,
        enabled: Boolean(override.enabled),
      });
    }

    return assignments;
  }

  private async composeScenarioLorebookAssignments(
    tx: SqliteTransaction,
    participants: Array<{ participantId: string; characterId: string }>,
    requestedAssignments: readonly ScenarioLorebookAssignmentInput[]
  ): Promise<ScenarioLorebookAssignmentInput[]> {
    const participantCharacterIds = new Set(participants.map((p) => p.characterId));

    const manualAssignments = new Map<string, ScenarioLorebookAssignmentInput>();
    const overrideAssignments = new Map<string, ScenarioLorebookAssignmentInput>();

    for (const assignment of requestedAssignments) {
      if (assignment.kind === "manual") {
        manualAssignments.set(assignment.lorebookId, {
          kind: "manual",
          lorebookId: assignment.lorebookId,
          enabled: assignment.enabled ?? true,
        });
        continue;
      }

      overrideAssignments.set(assignment.characterLorebookId, {
        kind: "character",
        characterLorebookId: assignment.characterLorebookId,
        enabled: assignment.enabled ?? true,
      });
    }

    if (overrideAssignments.size > 0) {
      const characterLorebookIds = Array.from(overrideAssignments.keys());
      const links = await tx
        .select({
          id: schema.characterLorebooks.id,
          characterId: schema.characterLorebooks.characterId,
        })
        .from(schema.characterLorebooks)
        .where(inArray(schema.characterLorebooks.id, characterLorebookIds));

      const validIds = new Set(
        links
          .filter((link) => link.characterId && participantCharacterIds.has(link.characterId))
          .map((link) => link.id)
      );

      for (const key of overrideAssignments.keys()) {
        if (!validIds.has(key)) {
          overrideAssignments.delete(key);
        }
      }
    }

    return [...manualAssignments.values(), ...overrideAssignments.values()];
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
      characterId: ScenarioParticipantRow["characterId"];
      type: ScenarioParticipantRow["type"];
      role?: ScenarioParticipantRow["role"];
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

      const hasNarrator = ps.some((p) => p.type === "narrator" && p.characterId === null);
      if (type === "narrator" && hasNarrator) {
        throw new ServiceError("Conflict", {
          message: "Scenario can only have one narrator.",
        });
      }

      const maxOrderIndex = ps.reduce((max, p) => Math.max(max, p.orderIndex ?? 0), -1);

      const result = await tx
        .insert(schema.scenarioParticipants)
        .values({
          scenarioId,
          characterId,
          type,
          role,
          orderIndex: type === "narrator" ? 999 : maxOrderIndex + 1,
          colorOverride: null,
        })
        .returning();

      const participantSnapshots = await this.getParticipantSnapshots(tx, scenarioId);
      const requestedAssignments = await this.getExistingScenarioLorebooks(tx, scenarioId);
      const assignments = await this.composeScenarioLorebookAssignments(
        tx,
        participantSnapshots,
        requestedAssignments
      );
      await this.lorebookService.replaceScenarioLorebookSettings(scenarioId, assignments, tx);

      return result[0];
    };
    return outerTx ? work(outerTx) : this.db.transaction(work);
  }
}

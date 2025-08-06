import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { BaseRepository } from "../../db/base.repository";
import { type StoryforgeSqliteDatabase, schema } from "../../db/client";
import type { Character } from "../../db/schema/characters";
import type { ScenarioCharacter } from "../../db/schema/scenario-characters";

export interface ScenarioCharacterAssignment extends ScenarioCharacter {
  character: Character;
  isActive: boolean;
}

export interface AssignCharacterOptions {
  role?: string;
  orderIndex?: number;
}

export interface CharacterOrder {
  characterId: string;
  orderIndex: number;
}

export class ScenarioCharacterRepository extends BaseRepository<
  typeof schema.scenarioCharacters
> {
  constructor(database: StoryforgeSqliteDatabase) {
    super(database, schema.scenarioCharacters, "scenario-character");
  }

  async findByScenarioId(
    scenarioId: string,
    includeInactive?: boolean
  ): Promise<ScenarioCharacterAssignment[]> {
    const whereConditions = [eq(this.table.scenarioId, scenarioId)];

    if (!includeInactive) {
      whereConditions.push(isNull(this.table.unassignedAt));
    }

    const results = await this.db
      .select({ assignment: this.table, character: schema.characters })
      .from(this.table)
      .innerJoin(
        schema.characters,
        eq(this.table.characterId, schema.characters.id)
      )
      .where(and(...whereConditions))
      .orderBy(this.table.orderIndex);

    return results.map((r) => ({
      ...r.assignment,
      character: r.character,
      isActive: r.assignment.unassignedAt === null,
    }));
  }

  async findByCharacterId(
    characterId: string,
    includeInactive?: boolean
  ): Promise<ScenarioCharacterAssignment[]> {
    const whereConditions = [eq(this.table.characterId, characterId)];

    if (!includeInactive) {
      whereConditions.push(isNull(this.table.unassignedAt));
    }

    const results = await this.db
      .select({
        assignment: this.table,
        character: schema.characters,
      })
      .from(this.table)
      .innerJoin(
        schema.characters,
        eq(this.table.characterId, schema.characters.id)
      )
      .where(and(...whereConditions))
      .orderBy(this.table.orderIndex);

    return results.map((r) => ({
      ...r.assignment,
      character: r.character,
      isActive: r.assignment.unassignedAt === null,
    }));
  }

  async findAssignment(
    scenarioId: string,
    characterId: string
  ): Promise<ScenarioCharacterAssignment | undefined> {
    const results = await this.db
      .select({
        assignment: this.table,
        character: schema.characters,
      })
      .from(this.table)
      .innerJoin(
        schema.characters,
        eq(this.table.characterId, schema.characters.id)
      )
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          eq(this.table.characterId, characterId)
        )
      )
      .limit(1);

    if (!results[0]) return undefined;

    const result = results[0];
    return {
      ...result.assignment,
      character: result.character,
      isActive: result.assignment.unassignedAt === null,
    };
  }

  async unassign(scenarioId: string, characterId: string): Promise<boolean> {
    const [updated] = await this.db
      .update(this.table)
      .set({
        unassignedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          eq(this.table.characterId, characterId),
          isNull(this.table.unassignedAt)
        )
      )
      .returning();

    return !!updated;
  }

  async reassign(
    scenarioId: string,
    characterId: string
  ): Promise<ScenarioCharacterAssignment> {
    // Find the existing record (should be inactive)
    const existingRecord = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          eq(this.table.characterId, characterId),
          isNotNull(this.table.unassignedAt)
        )
      )
      .limit(1);

    if (!existingRecord[0]) {
      throw new Error("No inactive assignment found to reactivate");
    }

    // Clear the unassignedAt timestamp to reactivate
    const [updated] = await this.db
      .update(this.table)
      .set({
        unassignedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(this.table.id, existingRecord[0].id))
      .returning();

    if (!updated) {
      throw new Error("Failed to reactivate character assignment");
    }

    // Get the character data
    const character = await this.db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.id, characterId))
      .limit(1);

    if (!character[0]) {
      throw new Error("Character not found");
    }

    return {
      ...updated,
      character: character[0],
      isActive: updated.unassignedAt === null,
    };
  }

  async getActiveAssignmentCount(scenarioId: string): Promise<number> {
    const results = await this.db
      .select({ count: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          isNull(this.table.unassignedAt)
        )
      );

    return results.length;
  }

  async getAllAssignments(
    scenarioId: string
  ): Promise<ScenarioCharacterAssignment[]> {
    return this.findByScenarioId(scenarioId, true);
  }

  async getActiveAssignments(
    scenarioId: string
  ): Promise<ScenarioCharacterAssignment[]> {
    return this.findByScenarioId(scenarioId, false);
  }

  async assignCharacter(
    scenarioId: string,
    characterId: string,
    options: AssignCharacterOptions = {}
  ): Promise<ScenarioCharacterAssignment> {
    const { role, orderIndex = 0 } = options;

    // Check if character is already assigned (active)
    const existingActive = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          eq(this.table.characterId, characterId),
          isNull(this.table.unassignedAt)
        )
      )
      .limit(1);

    if (existingActive.length > 0) {
      throw new Error("Character is already assigned to this scenario");
    }

    // Check if there's an existing record (inactive) that we can reuse
    const existingRecord = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          eq(this.table.characterId, characterId)
        )
      )
      .limit(1);

    let assignment: ScenarioCharacter;

    if (existingRecord.length > 0 && existingRecord[0]) {
      // Reuse existing record by clearing unassignedAt
      const [updated] = await this.db
        .update(this.table)
        .set({ role, orderIndex, unassignedAt: null, updatedAt: new Date() })
        .where(eq(this.table.id, existingRecord[0].id))
        .returning();

      if (!updated) {
        throw new Error("Failed to reactivate character assignment");
      }
      assignment = updated;
    } else {
      // Create new record
      const [created] = await this.db
        .insert(this.table)
        .values({ scenarioId, characterId, role, orderIndex })
        .returning();

      if (!created) {
        throw new Error("Failed to create character assignment");
      }
      assignment = created;
    }

    // Get the character data
    const character = await this.db
      .select()
      .from(schema.characters)
      .where(eq(schema.characters.id, characterId))
      .limit(1);

    if (!character[0]) {
      throw new Error("Character not found");
    }

    return {
      ...assignment,
      character: character[0],
      isActive: assignment.unassignedAt === null,
    };
  }

  async unassignCharacter(
    scenarioId: string,
    characterId: string
  ): Promise<void> {
    const [updated] = await this.db
      .update(this.table)
      .set({ unassignedAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          eq(this.table.characterId, characterId),
          isNull(this.table.unassignedAt)
        )
      )
      .returning();

    if (!updated) {
      throw new Error(
        "Character assignment not found or character not actively assigned"
      );
    }
  }

  async isCharacterAssigned(
    scenarioId: string,
    characterId: string
  ): Promise<boolean> {
    const result = await this.db
      .select({ id: this.table.id })
      .from(this.table)
      .where(
        and(
          eq(this.table.scenarioId, scenarioId),
          eq(this.table.characterId, characterId),
          isNull(this.table.unassignedAt)
        )
      )
      .limit(1);

    return result.length > 0;
  }

  async reorderCharacters(
    scenarioId: string,
    characterOrders: CharacterOrder[]
  ): Promise<void> {
    for (const { characterId, orderIndex } of characterOrders) {
      await this.db
        .update(this.table)
        .set({ orderIndex, updatedAt: new Date() })
        .where(
          and(
            eq(this.table.scenarioId, scenarioId),
            eq(this.table.characterId, characterId),
            isNull(this.table.unassignedAt)
          )
        );
    }
  }

  async getAssignedCharacters(
    scenarioId: string,
    includeInactive?: boolean
  ): Promise<ScenarioCharacterAssignment[]> {
    return this.findByScenarioId(scenarioId, includeInactive);
  }

  async getAssignedScenarios(
    characterId: string
  ): Promise<ScenarioCharacterAssignment[]> {
    return this.findByCharacterId(characterId, true);
  }

  // TODO: Private func to resolve conflicting order indices when assignment
  // changes are made.
}

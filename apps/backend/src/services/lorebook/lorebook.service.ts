import type { AssignLorebookInput, LinkCharacterLorebookInput } from "@storyforge/contracts";
import {
  type Lorebook,
  type NewLorebook,
  type SqliteDatabase,
  type SqliteTransaction,
  schema,
} from "@storyforge/db";
import {
  computeLorebookFingerprint,
  type LorebookData,
  normalizeLorebookData,
  parseLorebookData,
} from "@storyforge/lorebooks";
import { and, eq, sql } from "drizzle-orm";
import { ServiceError } from "../../service-error.js";
import { CharacterBookSchema } from "../character/utils/parse-tavern-card.js";
import { normalizeSillyTavernLorebook } from "./utils/sillytavern-lorebook-parser.js";

type CreateLorebookArgs = {
  data: LorebookData;
  source?: NewLorebook["source"];
};

type UpdateLorebookArgs = {
  id: string;
  data: LorebookData;
};

type ReorderInstruction = {
  lorebookId: string;
  orderIndex: number;
};

type ImportLorebookResult = {
  lorebook: Lorebook;
  created: boolean;
};

export class LorebookService {
  constructor(private readonly db: SqliteDatabase) {}

  async createLorebook(args: CreateLorebookArgs, outerTx?: SqliteTransaction) {
    const normalized = normalizeLorebookData(args.data);
    const fingerprint = computeLorebookFingerprint(normalized);
    const entryCount = normalized.entries.length;
    const name = normalized.name?.trim() || "Untitled Lorebook";
    const description = normalized.description?.trim() || null;
    const source = args.source ?? "manual";

    const work = async (tx: SqliteTransaction) => {
      const existing = await tx
        .select()
        .from(schema.lorebooks)
        .where(eq(schema.lorebooks.fingerprint, fingerprint))
        .limit(1);

      if (existing[0]) {
        return { lorebook: existing[0], created: false } satisfies ImportLorebookResult;
      }

      const [inserted] = await tx
        .insert(schema.lorebooks)
        .values({
          name,
          description,
          data: normalized,
          fingerprint,
          entryCount,
          source,
        })
        .returning();

      if (!inserted) {
        throw new ServiceError("InvalidInput", {
          message: "Failed to create lorebook.",
        });
      }

      return { lorebook: inserted, created: true } satisfies ImportLorebookResult;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async updateLorebook(args: UpdateLorebookArgs, outerTx?: SqliteTransaction) {
    const normalized = normalizeLorebookData(args.data);
    const fingerprint = computeLorebookFingerprint(normalized);
    const entryCount = normalized.entries.length;
    const name = normalized.name?.trim() || "Untitled Lorebook";
    const description = normalized.description?.trim() || null;

    const work = async (tx: SqliteTransaction) => {
      const [existing] = await tx
        .select()
        .from(schema.lorebooks)
        .where(eq(schema.lorebooks.id, args.id))
        .limit(1);

      if (!existing) {
        throw new ServiceError("NotFound", {
          message: `Lorebook ${args.id} not found.`,
        });
      }

      const [conflict] = await tx
        .select({ id: schema.lorebooks.id })
        .from(schema.lorebooks)
        .where(eq(schema.lorebooks.fingerprint, fingerprint))
        .limit(1);

      if (conflict && conflict.id !== args.id) {
        throw new ServiceError("Conflict", {
          message: "Another lorebook with identical content already exists.",
        });
      }

      const [updated] = await tx
        .update(schema.lorebooks)
        .set({
          name,
          description,
          data: normalized,
          fingerprint,
          entryCount,
        })
        .where(eq(schema.lorebooks.id, args.id))
        .returning();

      if (!updated) {
        throw new ServiceError("InvalidInput", {
          message: "Failed to update lorebook.",
        });
      }

      return updated;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async deleteLorebook(id: string) {
    const result = await this.db
      .delete(schema.lorebooks)
      .where(eq(schema.lorebooks.id, id))
      .returning();

    return result.length > 0;
  }

  async importLorebookFromDataUri(
    fileDataUri: string,
    source: NewLorebook["source"] = "silly_v2",
    options?: { filename?: string }
  ) {
    const buffer = decodeDataUri(fileDataUri);
    const parsedJson = parseJson(buffer.toString("utf8"));
    const maybeConverted = normalizeSillyTavernLorebook(parsedJson, {
      filename: options?.filename,
    });
    const data = maybeConverted
      ? normalizeLorebookData(maybeConverted)
      : normalizeLorebookData(coerceLorebookData(parsedJson));

    return this.createLorebook({ data, source });
  }

  async assignToScenario(args: AssignLorebookInput, outerTx?: SqliteTransaction) {
    const work = async (tx: SqliteTransaction) => {
      const existing = await tx
        .select()
        .from(schema.scenarioLorebooks)
        .where(
          and(
            eq(schema.scenarioLorebooks.scenarioId, args.scenarioId),
            eq(schema.scenarioLorebooks.lorebookId, args.lorebookId)
          )
        )
        .limit(1);

      if (existing[0]) {
        return existing[0];
      }

      let orderIndex = args.orderIndex;
      if (orderIndex === undefined) {
        const [maxOrder] = await tx
          .select({
            nextOrder: sql<number>`COALESCE(MAX(${schema.scenarioLorebooks.orderIndex}), -1) + 1`,
          })
          .from(schema.scenarioLorebooks)
          .where(eq(schema.scenarioLorebooks.scenarioId, args.scenarioId));
        orderIndex = maxOrder?.nextOrder ?? 0;
      }

      const [inserted] = await tx
        .insert(schema.scenarioLorebooks)
        .values({
          scenarioId: args.scenarioId,
          lorebookId: args.lorebookId,
          orderIndex,
        })
        .returning();

      return inserted;
    };

    return outerTx ? work(outerTx) : this.db.transaction(work);
  }

  async unassignFromScenario(args: AssignLorebookInput) {
    await this.db
      .delete(schema.scenarioLorebooks)
      .where(
        and(
          eq(schema.scenarioLorebooks.scenarioId, args.scenarioId),
          eq(schema.scenarioLorebooks.lorebookId, args.lorebookId)
        )
      );
  }

  async reorderScenarioLorebooks(
    scenarioId: string,
    orders: ReorderInstruction[],
    outerTx?: SqliteTransaction
  ) {
    const work = async (tx: SqliteTransaction) => {
      for (const order of orders) {
        await tx
          .update(schema.scenarioLorebooks)
          .set({ orderIndex: order.orderIndex })
          .where(
            and(
              eq(schema.scenarioLorebooks.scenarioId, scenarioId),
              eq(schema.scenarioLorebooks.lorebookId, order.lorebookId)
            )
          );
      }
    };

    await (outerTx ? work(outerTx) : this.db.transaction(work));
  }

  async linkLorebookToCharacter(args: LinkCharacterLorebookInput) {
    const existing = await this.db
      .select()
      .from(schema.characterLorebooks)
      .where(
        and(
          eq(schema.characterLorebooks.characterId, args.characterId),
          eq(schema.characterLorebooks.lorebookId, args.lorebookId)
        )
      )
      .limit(1);

    if (existing[0]) {
      return existing[0];
    }

    const [inserted] = await this.db.insert(schema.characterLorebooks).values(args).returning();

    return inserted;
  }

  async unlinkLorebookFromCharacter(args: LinkCharacterLorebookInput) {
    await this.db
      .delete(schema.characterLorebooks)
      .where(
        and(
          eq(schema.characterLorebooks.characterId, args.characterId),
          eq(schema.characterLorebooks.lorebookId, args.lorebookId)
        )
      );
  }

  async createLorebookFromCharacterCard(options: {
    characterId: string;
    linkToCharacter?: boolean;
  }) {
    const { characterId, linkToCharacter = true } = options;

    const rows = await this.db
      .select({
        id: schema.characters.id,
        name: schema.characters.name,
        tavernCardData: schema.characters.tavernCardData,
      })
      .from(schema.characters)
      .where(eq(schema.characters.id, characterId))
      .limit(1);

    const character = rows[0];
    if (!character) {
      throw new ServiceError("NotFound", {
        message: `Character ${characterId} not found.`,
      });
    }

    if (character.tavernCardData == null) {
      throw new ServiceError("InvalidInput", {
        message: "Character does not have Tavern card data to extract a character book.",
      });
    }

    const rawCard = coerceTavernCard(character.tavernCardData);
    const book = extractCharacterBook(rawCard);
    if (!book) {
      throw new ServiceError("InvalidInput", {
        message: "Character card does not include a character book.",
      });
    }

    const lorebookData: LorebookData = {
      name: book.name ?? `${character.name} Lorebook`,
      description: book.description,
      scan_depth: book.scan_depth,
      token_budget: book.token_budget,
      recursive_scanning: book.recursive_scanning,
      extensions: book.extensions ?? {},
      entries: book.entries.map((entry) => ({
        keys: [...entry.keys],
        content: entry.content,
        extensions: entry.extensions ?? {},
        enabled: entry.enabled,
        insertion_order: entry.insertion_order,
        case_sensitive: entry.case_sensitive,
        name: entry.name,
        priority: entry.priority,
        id: entry.id,
        comment: entry.comment,
        selective: entry.selective,
        secondary_keys: entry.secondary_keys ? [...entry.secondary_keys] : undefined,
        constant: entry.constant,
        position: entry.position,
      })),
    };

    const result = await this.createLorebook({ data: lorebookData, source: "character_book" });

    if (linkToCharacter) {
      await this.linkLorebookToCharacter({
        characterId,
        lorebookId: result.lorebook.id,
      });
    }

    return result;
  }
}

function decodeDataUri(dataUri: string) {
  const match = dataUri.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    throw new ServiceError("InvalidInput", {
      message: "Invalid file data URI provided for lorebook import.",
    });
  }

  return Buffer.from(match[1], "base64");
}

function parseJson(payload: string) {
  try {
    return JSON.parse(payload) as unknown;
  } catch (error) {
    throw new ServiceError("InvalidInput", {
      message: "Lorebook import file is not valid JSON.",
      cause: error,
    });
  }
}

function coerceLorebookData(raw: unknown): LorebookData {
  if (isLorebookWrapper(raw)) {
    return parseLorebookData(raw.data);
  }

  return parseLorebookData(raw);
}

function coerceTavernCard(value: unknown) {
  if (typeof value === "string") {
    return parseJson(value);
  }

  return value;
}

function extractCharacterBook(raw: unknown) {
  if (!isTavernCardV2(raw)) {
    return undefined;
  }

  if (!raw.data.character_book) {
    return undefined;
  }

  return CharacterBookSchema.parse(raw.data.character_book);
}

function isTavernCardV2(value: unknown): value is {
  spec: string;
  spec_version?: string;
  data: { character_book?: unknown } & Record<string, unknown>;
} {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const card = value as {
    spec?: unknown;
    data?: unknown;
  };

  if (card.spec !== "chara_card_v2") {
    return false;
  }

  if (typeof card.data !== "object" || card.data === null) {
    return false;
  }

  return true;
}

function isLorebookWrapper(value: unknown): value is { spec: string; data: unknown } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const maybe = value as { spec?: unknown; data?: unknown };
  return maybe.spec === "lorebook_v3" && maybe.data !== undefined;
}

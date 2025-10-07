import type { LorebookData } from "@storyforge/contracts";
import { schema } from "@storyforge/db";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { LorebookService } from "../services/lorebook/lorebook.service.js";
import { cleanupTestDatabase, createTestDatabase } from "./setup.js";

describe("LorebookService", () => {
  let db: Awaited<ReturnType<typeof createTestDatabase>> | undefined;

  afterEach(async () => {
    if (db) {
      cleanupTestDatabase(db);
      db = undefined;
    }
  });

  it("creates a lorebook from a character card and links it", async () => {
    db = await createTestDatabase();
    const svc = new LorebookService(db);

    const greetings: string[] = [];
    const tags: string[] = [];
    const sampleCard = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Lorebook Character",
        description: "A test character",
        personality: "curious",
        scenario: "Test scenario",
        first_mes: "Hello there",
        mes_example: "Example message",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        alternate_greetings: greetings,
        character_book: {
          name: "Lorebook Character Book",
          description: "Character specific lore",
          scan_depth: 3,
          token_budget: 256,
          recursive_scanning: false,
          extensions: {},
          entries: [
            {
              keys: ["alpha"],
              content: "Alpha information",
              extensions: {},
              enabled: true,
              insertion_order: 0,
              case_sensitive: false,
              name: "Alpha Entry",
            },
          ],
        },
        tags,
        creator: "Tester",
        character_version: "1.0",
        extensions: {},
      },
    };

    const inserted = await db
      .insert(schema.characters)
      .values({
        name: sampleCard.data.name,
        description: sampleCard.data.description,
        cardType: "character",
        legacyPersonality: sampleCard.data.personality,
        legacyScenario: sampleCard.data.scenario,
        creator: sampleCard.data.creator,
        creatorNotes: sampleCard.data.creator_notes,
        customSystemPrompt: sampleCard.data.system_prompt,
        styleInstructions: sampleCard.data.post_history_instructions,
        tags: sampleCard.data.tags,
        revision: sampleCard.data.character_version,
        tavernCardData: JSON.stringify(sampleCard),
      })
      .returning({ id: schema.characters.id });

    const character = inserted[0];
    expect(character).toBeDefined();

    const result = await svc.createLorebookFromCharacterCard({
      characterId: character.id,
    });

    expect(result.created).toBe(true);
    expect(result.lorebook.entryCount).toBe(1);
    expect(result.lorebook.name).toBe("Lorebook Character Book");

    const lorebookRows = await db.select().from(schema.lorebooks);
    expect(lorebookRows).toHaveLength(1);

    const [link] = await db
      .select()
      .from(schema.characterLorebooks)
      .where(eq(schema.characterLorebooks.characterId, character.id));
    expect(link).toBeDefined();
    expect(link.lorebookId).toBe(result.lorebook.id);

    const second = await svc.createLorebookFromCharacterCard({
      characterId: character.id,
    });

    expect(second.created).toBe(false);

    const links = await db
      .select({ id: schema.characterLorebooks.id })
      .from(schema.characterLorebooks)
      .where(eq(schema.characterLorebooks.characterId, character.id));
    expect(links).toHaveLength(1);
  });

  it("imports SillyTavern world info lorebook", async () => {
    db = await createTestDatabase();
    const svc = new LorebookService(db);

    const worldInfo = {
      name: "Test World",
      description: "Sample world info",
      scan_depth: 2,
      token_budget: 512,
      recursive_scanning: true,
      is_creation: false,
      entries: {
        "1": {
          keys: ["Alpha", "Beta"],
          keysecondary: ["Gamma"],
          content: "Entry content",
          comment: "Notes",
          insertion_order: 10,
          enabled: true,
          constant: true,
          selective: true,
          position: "before_char",
          extensions: { depth: 4 },
          weight: 5,
        },
      },
    };

    const dataUri = `data:application/json;base64,${Buffer.from(JSON.stringify(worldInfo)).toString("base64")}`;

    const result = await svc.importLorebookFromDataUri(dataUri, "silly_v2", {
      filename: "world-info.json",
    });

    expect(result.created).toBe(true);
    expect(result.lorebook.entryCount).toBe(1);
    expect(result.lorebook.name).toBe("Test World");

    const stored = await db.select().from(schema.lorebooks);
    expect(stored).toHaveLength(1);
    const [lorebook] = stored;
    const entries = (lorebook.data as LorebookData).entries;
    expect(entries).toHaveLength(1);
    expect(entries[0]?.keys).toEqual(["Alpha", "Beta"]);
    expect(entries[0]?.secondary_keys).toEqual(["Gamma"]);
    const extensions = entries[0]?.extensions as Record<string, unknown> | undefined;
    expect(extensions?.weight).toBe(5);
  });
});

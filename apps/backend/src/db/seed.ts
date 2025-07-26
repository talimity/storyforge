import { db, closeDatabase } from "./client";
import { characterRepository } from "../repositories/character.repository";
import { scenarioRepository } from "../repositories/scenario.repository";
import { lorebookRepository } from "../repositories/lorebook.repository";

async function seed() {
  console.log("🌱 Starting database seed...");

  try {
    // Clear existing data
    console.log("Clearing existing data...");
    db.delete(schema.turns).run();
    db.delete(schema.scenarioCharacters).run();
    db.delete(schema.lorebookEntries).run();
    db.delete(schema.scenarios).run();
    db.delete(schema.characters).run();
    db.delete(schema.lorebooks).run();

    // Create characters
    console.log("Creating characters...");
    const veridiana = await characterRepository.create({
      name: "Lady Veridiana",
      description:
        "A calculating noble of the fae courts with centuries of political experience",
      personality: "Calculating, eloquent, manipulative yet charming",
      avatar: null,
    });

    const thorn = await characterRepository.create({
      name: "Lord Thorn",
      description:
        "A suspicious lord who watches the court proceedings with careful eyes",
      personality: "Suspicious, watchful, protective of his interests",
      avatar: null,
    });

    const shadowBroker = await characterRepository.create({
      name: "The Shadow Broker",
      description:
        "A mysterious figure who deals in secrets and lurks in the shadows",
      personality: "Amused, mysterious, always knows more than they reveal",
      avatar: null,
    });

    console.log(
      `Created ${veridiana.name}, ${thorn.name}, ${shadowBroker.name}`
    );

    // Create scenario
    console.log("Creating scenario...");
    const scenario = await scenarioRepository.createWithCharacters(
      {
        name: "The Autumn Court Intrigue",
        description: "A tale of political maneuvering in the fae courts",
      },
      [veridiana.id, thorn.id, shadowBroker.id]
    );

    // Add turns
    console.log("Adding turns to scenario...");
    await scenarioRepository.addTurn(scenario.id, {
      characterId: null,
      content:
        "The Court of Whispers stands in magnificent splendor, its halls adorned with the colors of autumn. Nobles from across the realm have gathered for what promises to be a pivotal moment in fae politics. The air itself seems to shimmer with anticipation and barely contained magic.",
      timestamp: new Date(Date.now() - 3600000),
      orderIndex: 0,
      agentData: null,
    });

    await scenarioRepository.addTurn(scenario.id, {
      characterId: veridiana.id,
      content:
        "Lady Veridiana enters the great hall, her emerald gown catching the light of the enchanted chandeliers above. Her presence commands attention, and conversations pause as she moves with calculated grace through the crowd. Every step is deliberate, every glance meaningful.",
      timestamp: new Date(Date.now() - 1800000),
      orderIndex: 1,
      agentData: null,
    });

    await scenarioRepository.addTurn(scenario.id, {
      characterId: veridiana.id,
      content: `The golden leaves of autumn swirl through the air as Lady Veridiana steps into the Court of Whispers. Her emerald gown rustles softly against the marble floor, each footstep calculated and deliberate. The other nobles watch her approach with a mixture of curiosity and wariness.

"My lords and ladies," she begins, her voice carrying the weight of centuries, "I come before you today with news that will change the very fabric of our realm."

Lord Thorn's eyes narrow from across the chamber. He has suspected her of plotting for weeks, but now his suspicions seem confirmed. The Shadow Broker, meanwhile, observes from the shadows with barely concealed amusement—as if he knows something the others do not.

The tension in the air is palpable as all eyes turn to Lady Veridiana, waiting for her next words.`,
      timestamp: new Date(),
      orderIndex: 2,
      agentData: {
        plannerOutput:
          "Lady Veridiana will reveal critical information while Lord Thorn grows suspicious and the Shadow Broker remains enigmatic",
        screenplayOutput:
          "INT. COURT OF WHISPERS - DAY\\nLady Veridiana enters with purpose. Lord Thorn watches suspiciously. The Shadow Broker observes from shadows.",
        proseOutput: "The autumn court scene with building tension",
      },
    });

    // Create lorebook
    console.log("Creating lorebook...");
    await lorebookRepository.createWithEntries(
      {
        name: "The Fae Courts",
        description:
          "Knowledge about the various fae courts and their politics",
      },
      [
        {
          triggers: ["Court of Whispers", "fae court", "autumn court"],
          content:
            "The Court of Whispers is one of the four seasonal courts of the fae realm. Known for its political intrigue and the trading of secrets, it meets during the autumn season when the veil between worlds is thinnest.",
          enabled: true,
          orderIndex: 0,
        },
        {
          triggers: ["fae politics", "court intrigue"],
          content:
            "Fae politics operate on principles of bargains, oaths, and carefully worded agreements. Breaking one's word is not just dishonorable but can have magical consequences.",
          enabled: true,
          orderIndex: 1,
        },
      ]
    );

    console.log("✅ Database seeded successfully!");
    console.log(`  - Created 3 characters`);
    console.log(`  - Created 1 scenario with 3 turns`);
    console.log(`  - Created 1 lorebook with 2 entries`);
  } catch (error) {
    console.error("❌ Seed failed:", error);
    throw error;
  } finally {
    closeDatabase();
  }
}

// Import schema for clearing data
import * as schema from "./schema";

seed().catch(console.error);

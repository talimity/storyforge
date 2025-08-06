#!/usr/bin/env tsx
/**
 * Test script for scenario repository functionality
 */

import {
  scenarioCharacterRepository,
  scenarioRepository,
} from "../src/shelf/scenario";

async function testScenarioRepository() {
  console.log("🧪 Testing Scenario Repository");
  console.log("===============================\n");

  try {
    // Test 1: Create a scenario
    console.log("📝 Test 1: Creating a scenario...");
    const scenario1 = await scenarioRepository.create({
      name: "Test Adventure",
      description: "A testing scenario for repository validation",
      status: "active",
      settings: { difficulty: "medium" },
      metadata: { version: "1.0" },
    });
    console.log("✅ Created scenario:", scenario1.id, "-", scenario1.name);

    // Test 2: Create scenario with characters
    console.log("\n📝 Test 2: Creating scenario with characters...");
    const scenario2 = await scenarioRepository.createWithCharacters({
      name: "Multi-Character Adventure",
      description: "Testing character assignment during creation",
      status: "active",
      settings: { maxPlayers: 4 },
      metadata: { tags: ["group", "adventure"] },
      characterIds: [
        "iz1p5pdybh6q4wx4dh4ihwoe", // Kyria
        "crc3yfd793av1xs9plujaapl", // Phantom
      ],
    });
    console.log("✅ Created scenario with characters:", scenario2.id);
    console.log("   Characters assigned:", scenario2.characters.length);

    // Test 3: Find by status
    console.log("\n📝 Test 3: Finding active scenarios...");
    const activeScenarios = await scenarioRepository.findByStatus("active");
    console.log("✅ Found", activeScenarios.length, "active scenarios");

    // Test 4: Get scenario with characters
    console.log("\n📝 Test 4: Getting scenario with characters...");
    const scenarioWithChars = await scenarioRepository.findByIdWithCharacters(
      scenario2.id
    );
    console.log(
      "✅ Retrieved scenario with",
      scenarioWithChars?.characters.length,
      "characters"
    );

    // Test 5: Assign additional character
    console.log("\n📝 Test 5: Assigning additional character...");
    const assignment = await scenarioCharacterRepository.assignCharacter(
      scenario1.id,
      "dq9dvtd3s8pz897g7syvn0xg", // Sarah Ashworth
      { role: "Scholar", orderIndex: 0 }
    );
    console.log(
      "✅ Assigned character:",
      assignment.character.name,
      "as",
      assignment.role
    );

    // Test 6: Check if character is assigned
    console.log("\n📝 Test 6: Checking character assignment...");
    const isAssigned = await scenarioCharacterRepository.isCharacterAssigned(
      scenario1.id,
      "dq9dvtd3s8pz897g7syvn0xg"
    );
    console.log("✅ Character is assigned:", isAssigned);

    // Test 7: Get assigned characters
    console.log("\n📝 Test 7: Getting assigned characters...");
    const assignments = await scenarioCharacterRepository.getAssignedCharacters(
      scenario1.id
    );
    console.log("✅ Active assignments:", assignments.length);
    assignments.forEach((a, i) => {
      console.log(
        `   ${i + 1}. ${a.character.name} (${a.role || "No role"}) - Active: ${a.isActive}`
      );
    });

    // Test 8: Unassign character (soft delete)
    console.log("\n📝 Test 8: Unassigning character (soft delete)...");
    await scenarioCharacterRepository.unassignCharacter(
      scenario1.id,
      "dq9dvtd3s8pz897g7syvn0xg"
    );
    console.log("✅ Character unassigned successfully");

    // Test 9: Verify soft delete (should be inactive now)
    console.log("\n📝 Test 9: Verifying soft delete...");
    const activeAssignments =
      await scenarioCharacterRepository.getAssignedCharacters(
        scenario1.id,
        false
      );
    const allAssignments =
      await scenarioCharacterRepository.getAssignedCharacters(
        scenario1.id,
        true
      );
    console.log("✅ Active assignments:", activeAssignments.length);
    console.log(
      "✅ Total assignments (including inactive):",
      allAssignments.length
    );

    // Test 10: Re-assign character (record reuse)
    console.log("\n📝 Test 10: Re-assigning character (record reuse)...");
    const reassignment = await scenarioCharacterRepository.assignCharacter(
      scenario1.id,
      "dq9dvtd3s8pz897g7syvn0xg",
      { role: "Returned Scholar", orderIndex: 1 }
    );
    console.log("✅ Re-assigned character:", reassignment.character.name);
    console.log("   New role:", reassignment.role);
    console.log(
      "   Assignment ID:",
      reassignment.id,
      "(should be same as before)"
    );

    // Test 11: Reorder characters
    console.log("\n📝 Test 11: Testing character reordering...");
    await scenarioCharacterRepository.reorderCharacters(scenario2.id, [
      { characterId: "crc3yfd793av1xs9plujaapl", orderIndex: 0 }, // Phantom first
      { characterId: "iz1p5pdybh6q4wx4dh4ihwoe", orderIndex: 1 }, // Kyria second
    ]);

    const reorderedScenario = await scenarioRepository.findByIdWithCharacters(
      scenario2.id
    );
    console.log("✅ Characters reordered:");
    reorderedScenario?.characters
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .forEach((char, _i) => {
        console.log(`   ${char.orderIndex}. ${char.character.name}`);
      });

    // Test 12: Update scenario
    console.log("\n📝 Test 12: Updating scenario...");
    const updatedScenario = await scenarioRepository.update(scenario1.id, {
      name: "Updated Test Adventure",
      status: "archived",
    });
    console.log(
      "✅ Updated scenario:",
      updatedScenario?.name,
      "- Status:",
      updatedScenario?.status
    );

    console.log("\n🎉 All repository tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the tests
testScenarioRepository()
  .then(() => {
    console.log("\n✨ Repository testing completed!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("💥 Fatal error during testing:", error);
    process.exit(1);
  });

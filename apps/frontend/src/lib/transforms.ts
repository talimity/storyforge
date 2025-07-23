import { Scenario, Character, Turn, UIScenario, UICharacter, UITurn } from '@storyforge/shared';

/**
 * Transform domain Character to UI Character
 */
export function transformCharacterToUI(character: Character): UICharacter {
  return {
    ...character,
    isActive: false, // Will be determined by scenario context
    mood: 'Neutral', // Default mood
    status: 'Ready', // Default status
  };
}

/**
 * Transform domain Characters to UI Characters with scenario context
 */
export function transformCharactersToUI(
  characters: Character[], 
  activeCharacterIds: string[] = []
): UICharacter[] {
  return characters.map(character => ({
    ...transformCharacterToUI(character),
    isActive: activeCharacterIds.includes(character.id),
  }));
}

/**
 * Transform domain Turn to UI Turn
 */
export function transformTurnToUI(turn: Turn, index: number): UITurn {
  return {
    id: index + 1, // Frontend uses incremental numbers for display
    number: index + 1,
    content: turn.content,
    timestamp: new Date(turn.timestamp),
    activeCharacters: turn.character ? [turn.character] : [],
    isCurrentTurn: false, // Will be set by the consuming component
  };
}

/**
 * Transform domain Scenario to UI Scenario with character data
 */
export function transformScenarioToUI(
  scenario: Scenario, 
  characters: Character[]
): UIScenario {
  // Filter characters that are part of this scenario
  const scenarioCharacters = characters.filter(char => 
    scenario.characters.includes(char.id)
  );

  // Get all active character IDs from the current turn
  const currentTurn = scenario.turns[scenario.turns.length - 1];
  const activeCharacterIds = currentTurn?.character ? [currentTurn.character] : [];

  return {
    id: scenario.id,
    name: scenario.name,
    description: scenario.description,
    turnCount: scenario.turns.length,
    characters: transformCharactersToUI(scenarioCharacters, activeCharacterIds),
    turns: scenario.turns.map((turn, index) => transformTurnToUI(turn, index)),
    currentTurnIndex: scenario.turns.length - 1,
  };
}

/**
 * Transform UI Scenario back to domain Scenario (for updates)
 */
export function transformUIScenarioToDomain(uiScenario: UIScenario): Partial<Scenario> {
  return {
    id: uiScenario.id,
    name: uiScenario.name,
    description: uiScenario.description,
    characters: uiScenario.characters.map(char => char.id),
    // Note: turns are typically not updated from UI, they're added via separate API calls
  };
}

/**
 * Transform UI Character back to domain Character (for updates)
 */
export function transformUICharacterToDomain(uiCharacter: UICharacter): Partial<Character> {
  const { isActive, mood, status, ...domainFields } = uiCharacter;
  return domainFields;
}
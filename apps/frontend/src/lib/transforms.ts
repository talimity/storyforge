import type {
  CharacterDTO,
  Scenario,
  Turn,
  UICharacter,
  UIScenario,
  UITurn,
} from "@storyforge/shared";

export function transformCharacterToUI(character: CharacterDTO): UICharacter {
  return {
    ...character,
    isActive: false,
    mood: "Neutral",
    status: "Ready",
  };
}

export function transformCharactersToUI(
  characters: CharacterDTO[],
  activeCharacterIds: string[] = []
): UICharacter[] {
  return characters.map((character) => ({
    ...transformCharacterToUI(character),
    isActive: activeCharacterIds.includes(character.id),
  }));
}

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

export function transformScenarioToUI(
  scenario: Scenario,
  characters: CharacterDTO[]
): UIScenario {
  const scenarioCharacters = characters.filter((char) =>
    scenario.characters.includes(char.id)
  );

  const currentTurn = scenario.turns[scenario.turns.length - 1];
  const activeCharacterIds = currentTurn?.character
    ? [currentTurn.character]
    : [];

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

export function transformUIScenarioToDomain(
  uiScenario: UIScenario
): Partial<Scenario> {
  return {
    id: uiScenario.id,
    name: uiScenario.name,
    description: uiScenario.description,
    characters: uiScenario.characters.map((char) => char.id),
    // Note: turns are typically not updated from UI, they're added via separate API calls
  };
}

export function transformUICharacterToDomain(
  uiCharacter: UICharacter
): Partial<CharacterDTO> {
  const { isActive: _, mood: __, status: ___, ...domainFields } = uiCharacter;
  return domainFields;
}

import type { TavernCard } from "./taverncard";

export interface CharacterDTO {
  id: string;
  name: string;
  description: string;
  legacyPersonality: string | null;
  legacyScenario: string | null;
  creator: string | null;
  creatorNotes: string | null;
  customSystemPrompt: string | null;
  customPostHistoryInstructions: string | null;
  tags: string[];
  sfCharaVersion: string | null;
  originalCardData: TavernCard | null;
  imagePath: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterGreetingDTO {
  id: string;
  characterId: string;
  message: string;
  isPrimary: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterExampleDTO {
  id: string;
  characterId: string;
  exampleTemplate: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterWithRelations extends CharacterDTO {
  greetings: CharacterGreetingDTO[];
  examples: CharacterExampleDTO[];
}

// UI-specific extensions
export interface UICharacter extends CharacterDTO {
  isActive?: boolean;
  mood?: string;
  status?: string;
}

export interface CharactersResponse {
  characters: CharacterDTO[];
}

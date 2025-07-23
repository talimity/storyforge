// ===== DOMAIN MODELS =====
// These represent the core data structures as stored and transmitted

export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string;
  avatar: string | null;
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  characters: string[]; // Character IDs
  turns: Turn[];
}

export interface Turn {
  character: string | null; // Character ID, null for narrator/director turns
  content: string;
  timestamp: string; // ISO string for serialization
  agentData?: {
    plannerOutput?: string;
    screenplayOutput?: string;
    proseOutput?: string;
  };
}

export interface Lorebook {
  id: string;
  name: string;
  description: string;
  entries: LorebookEntry[];
}

export interface LorebookEntry {
  id: string;
  trigger: string[]; // Keywords that trigger this entry
  content: string;
  enabled: boolean;
}

// ===== API RESPONSE TYPES =====
// These wrap domain models for API responses

export interface ScenariosResponse {
  scenarios: Scenario[];
}

export interface CharactersResponse {
  characters: Character[];
}

export interface LorebooksResponse {
  lorebooks: Lorebook[];
}

// ===== FRONTEND UI TYPES =====
// These extend domain models with UI-specific state

export interface UICharacter extends Character {
  isActive?: boolean;
  mood?: string;
  status?: string;
}

export interface UITurn {
  id: number; // Frontend uses incremental numbers for display
  number: number;
  content: string;
  timestamp: Date;
  activeCharacters: string[]; // Character IDs
  isCurrentTurn?: boolean;
}

export interface UIScenario {
  id: string;
  name: string;
  description: string;
  turnCount: number;
  characters: UICharacter[];
  turns: UITurn[];
  currentTurnIndex: number;
}

export type InputMode = 'director' | 'character';

export interface ProcessingStep {
  name: string;
  description: string;
  progress: number;
}
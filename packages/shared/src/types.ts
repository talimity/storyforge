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

export type InputMode = "director" | "character";

export interface ProcessingStep {
  name: string;
  description: string;
  progress: number;
}

// ===== CHARACTER CARD TYPES =====
// Types for importing SillyTavern character cards

export interface TavernCardV1 {
  name: string;
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
}

export interface CharacterBookEntry {
  keys: string[];
  content: string;
  extensions: Record<string, unknown>;
  enabled: boolean;
  insertion_order: number;
  case_sensitive?: boolean;
  name?: string;
  priority?: number;
  id?: number;
  comment?: string;
  selective?: boolean;
  secondary_keys?: string[];
  constant?: boolean;
  position?: 'before_char' | 'after_char';
}

export interface CharacterBook {
  name?: string;
  description?: string;
  scan_depth?: number;
  token_budget?: number;
  recursive_scanning?: boolean;
  extensions: Record<string, unknown>;
  entries: CharacterBookEntry[];
}

export interface TavernCardV2 {
  spec: 'chara_card_v2';
  spec_version: '2.0';
  data: {
    name: string;
    description: string;
    personality: string;
    scenario: string;
    first_mes: string;
    mes_example: string;
    creator_notes: string;
    system_prompt: string;
    post_history_instructions: string;
    alternate_greetings: string[];
    character_book?: CharacterBook;
    tags: string[];
    creator: string;
    character_version: string;
    extensions: Record<string, unknown>;
  };
}

export type TavernCard = TavernCardV1 | TavernCardV2;

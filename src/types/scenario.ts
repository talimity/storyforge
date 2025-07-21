
export interface Character {
  id: number;
  name: string;
  avatar: string | null;
  isActive: boolean;
  mood: string;
  status: string;
}

export interface Turn {
  id: number;
  number: number;
  content: string;
  timestamp: Date;
  activeCharacters: string[];
  isCurrentTurn?: boolean;
}

export interface Scenario {
  id: number;
  name: string;
  description: string;
  turnCount: number;
  characters: Character[];
  turns: Turn[];
  currentTurnIndex: number;
}

export type InputMode = 'director' | 'character';

export interface ProcessingStep {
  name: string;
  description: string;
  progress: number;
}

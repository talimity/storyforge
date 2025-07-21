export interface Character {
  id: string;
  name: string;
  description: string;
  personality: string;
  avatar?: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  characters: Character[];
  turns: Turn[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Turn {
  id: string;
  character: Character;
  content: string;
  timestamp: Date;
  agentData?: {
    plannerOutput?: string;
    screenplayOutput?: string;
    proseOutput?: string;
  };
}

export interface Lorebook {
  id: string;
  name: string;
  entries: LorebookEntry[];
}

export interface LorebookEntry {
  id: string;
  keys: string[];
  content: string;
  priority: number;
}
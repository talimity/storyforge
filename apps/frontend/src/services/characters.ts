import type { Character, CharactersListResponse } from "@storyforge/api";
import { api } from "./api-client";

export const charactersService = {
  async getAll(): Promise<Character[]> {
    const response = await api.get<CharactersListResponse>("/api/characters");
    return response.characters;
  },

  async getById(id: string): Promise<Character> {
    return api.get<Character>(`/api/characters/${id}`);
  },

  async create(character: Omit<Character, "id">): Promise<Character> {
    return api.post<Character>("/api/characters", character);
  },

  async update(id: string, character: Partial<Character>): Promise<Character> {
    return api.put<Character>(`/api/characters/${id}`, character);
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/characters/${id}`);
  },
};

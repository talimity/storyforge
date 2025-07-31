import { api } from "./api-client";
import { CharacterDTO, CharactersResponse } from "@storyforge/shared";

export const charactersService = {
  async getAll(): Promise<CharacterDTO[]> {
    const response = await api.get<CharactersResponse>("/api/characters");
    return response.characters;
  },

  async getById(id: string): Promise<CharacterDTO> {
    return api.get<CharacterDTO>(`/api/characters/${id}`);
  },

  async create(character: Omit<CharacterDTO, "id">): Promise<CharacterDTO> {
    return api.post<CharacterDTO>("/api/characters", character);
  },

  async update(
    id: string,
    character: Partial<CharacterDTO>
  ): Promise<CharacterDTO> {
    return api.put<CharacterDTO>(`/api/characters/${id}`, character);
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/characters/${id}`);
  },
};

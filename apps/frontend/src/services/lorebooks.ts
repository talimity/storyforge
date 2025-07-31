import { api } from "./api-client";
import { Lorebook, LorebooksResponse } from "@storyforge/shared";

export const lorebooksService = {
  async getAll(): Promise<Lorebook[]> {
    const response = await api.get<LorebooksResponse>("/api/lorebooks");
    return response.lorebooks;
  },

  async getById(id: string): Promise<Lorebook> {
    return api.get<Lorebook>(`/api/lorebooks/${id}`);
  },

  async create(lorebook: Omit<Lorebook, "id">): Promise<Lorebook> {
    return api.post<Lorebook>("/api/lorebooks", lorebook);
  },

  async update(id: string, lorebook: Partial<Lorebook>): Promise<Lorebook> {
    return api.put<Lorebook>(`/api/lorebooks/${id}`, lorebook);
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/lorebooks/${id}`);
  },
};

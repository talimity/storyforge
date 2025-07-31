import { api } from "./api-client";
import { Scenario, ScenariosResponse } from "@storyforge/shared";

export const scenariosService = {
  async getAll(): Promise<Scenario[]> {
    const response = await api.get<ScenariosResponse>("/api/scenarios");
    return response.scenarios;
  },

  async getById(id: string): Promise<Scenario> {
    return api.get<Scenario>(`/api/scenarios/${id}`);
  },

  async create(scenario: Omit<Scenario, "id">): Promise<Scenario> {
    return api.post<Scenario>("/api/scenarios", scenario);
  },

  async update(id: string, scenario: Partial<Scenario>): Promise<Scenario> {
    return api.put<Scenario>(`/api/scenarios/${id}`, scenario);
  },

  async delete(id: string): Promise<void> {
    return api.delete(`/api/scenarios/${id}`);
  },
};

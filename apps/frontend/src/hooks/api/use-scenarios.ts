import type { Scenario } from "@storyforge/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { scenariosService } from "@/services";

const FIVE_MINUTES = 5 * 60 * 1000;

export const scenarioKeys = {
  all: ["scenarios"] as const,
  lists: () => [...scenarioKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...scenarioKeys.lists(), filters] as const,
  details: () => [...scenarioKeys.all, "detail"] as const,
  detail: (id: string) => [...scenarioKeys.details(), id] as const,
};

export function useScenarios() {
  return useQuery({
    queryKey: scenarioKeys.lists(),
    queryFn: () => scenariosService.getAll(),
    staleTime: FIVE_MINUTES,
  });
}

export function useScenario(id: string) {
  return useQuery({
    queryKey: scenarioKeys.detail(id),
    queryFn: () => scenariosService.getById(id),
    enabled: !!id,
    staleTime: FIVE_MINUTES,
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scenario: Omit<Scenario, "id">) =>
      scenariosService.create(scenario),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: scenarioKeys.lists() });
    },
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      scenario,
    }: {
      id: string;
      scenario: Partial<Scenario>;
    }) => scenariosService.update(id, scenario),
    onSuccess: (updatedScenario) => {
      queryClient.setQueryData(
        scenarioKeys.detail(updatedScenario.id),
        updatedScenario
      );

      queryClient.invalidateQueries({ queryKey: scenarioKeys.lists() });
    },
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => scenariosService.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: scenarioKeys.detail(deletedId) });

      queryClient.invalidateQueries({ queryKey: scenarioKeys.lists() });
    },
  });
}

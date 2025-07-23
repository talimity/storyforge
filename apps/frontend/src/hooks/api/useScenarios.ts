import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { scenariosService } from '@/services';
import { Scenario } from '@storyforge/shared';

const FIVE_MINUTES = 5 * 60 * 1000;

export const scenarioKeys = {
  all: ['scenarios'] as const,
  lists: () => [...scenarioKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...scenarioKeys.lists(), filters] as const,
  details: () => [...scenarioKeys.all, 'detail'] as const,
  detail: (id: string) => [...scenarioKeys.details(), id] as const,
};

// Get all scenarios
export function useScenarios() {
  return useQuery({
    queryKey: scenarioKeys.lists(),
    queryFn: () => scenariosService.getAll(),
    staleTime: FIVE_MINUTES,
  });
}

// Get single scenario
export function useScenario(id: string) {
  return useQuery({
    queryKey: scenarioKeys.detail(id),
    queryFn: () => scenariosService.getById(id),
    enabled: !!id,
    staleTime: FIVE_MINUTES,
  });
}

// Create scenario mutation
export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (scenario: Omit<Scenario, 'id'>) => scenariosService.create(scenario),
    onSuccess: () => {
      // Invalidate and refetch scenarios list
      queryClient.invalidateQueries({ queryKey: scenarioKeys.lists() });
    },
  });
}

// Update scenario mutation
export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, scenario }: { id: string; scenario: Partial<Scenario> }) =>
      scenariosService.update(id, scenario),
    onSuccess: (updatedScenario) => {
      // Update the specific scenario in cache
      queryClient.setQueryData(scenarioKeys.detail(updatedScenario.id), updatedScenario);
      // Invalidate the list to ensure consistency
      queryClient.invalidateQueries({ queryKey: scenarioKeys.lists() });
    },
  });
}

// Delete scenario mutation
export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => scenariosService.delete(id),
    onSuccess: (_, deletedId) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: scenarioKeys.detail(deletedId) });
      // Invalidate list
      queryClient.invalidateQueries({ queryKey: scenarioKeys.lists() });
    },
  });
}

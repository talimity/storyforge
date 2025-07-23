import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { charactersService } from '@/services';
import { Character } from '@storyforge/shared';

const FIVE_MINUTES = 5 * 60 * 1000;

export const characterKeys = {
  all: ['characters'] as const,
  lists: () => [...characterKeys.all, 'list'] as const,
  list: (filters: Record<string, unknown>) => [...characterKeys.lists(), filters] as const,
  details: () => [...characterKeys.all, 'detail'] as const,
  detail: (id: string) => [...characterKeys.details(), id] as const,
};

// Get all characters
export function useCharacters() {
  return useQuery({
    queryKey: characterKeys.lists(),
    queryFn: () => charactersService.getAll(),
    staleTime: FIVE_MINUTES,
  });
}

// Get single character
export function useCharacter(id: string) {
  return useQuery({
    queryKey: characterKeys.detail(id),
    queryFn: () => charactersService.getById(id),
    enabled: !!id,
    staleTime: FIVE_MINUTES,
  });
}

// Create character mutation
export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (character: Omit<Character, 'id'>) => charactersService.create(character),
    onSuccess: () => {
      // Invalidate and refetch characters list
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

// Update character mutation
export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, character }: { id: string; character: Partial<Character> }) =>
      charactersService.update(id, character),
    onSuccess: (updatedCharacter) => {
      queryClient.setQueryData(characterKeys.detail(updatedCharacter.id), updatedCharacter);
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

// Delete character mutation
export function useDeleteCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => charactersService.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: characterKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

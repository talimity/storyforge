import type { Character } from "@storyforge/api";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { charactersService } from "@/services";

const FIVE_MINUTES = 5 * 60 * 1000;

export const characterKeys = {
  all: ["characters"] as const,
  lists: () => [...characterKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...characterKeys.lists(), filters] as const,
  details: () => [...characterKeys.all, "detail"] as const,
  detail: (id: string) => [...characterKeys.details(), id] as const,
};

export function useCharacters() {
  return useQuery({
    queryKey: characterKeys.lists(),
    queryFn: () => charactersService.getAll(),
    staleTime: FIVE_MINUTES,
  });
}

export function useCharacter(id: string) {
  return useQuery({
    queryKey: characterKeys.detail(id),
    queryFn: () => charactersService.getById(id),
    enabled: !!id,
    staleTime: FIVE_MINUTES,
  });
}

export function useCreateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (character: Omit<Character, "id">) =>
      charactersService.create(character),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

export function useUpdateCharacter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      character,
    }: {
      id: string;
      character: Partial<Character>;
    }) => charactersService.update(id, character),
    onSuccess: (updatedCharacter) => {
      queryClient.setQueryData(
        characterKeys.detail(updatedCharacter.id),
        updatedCharacter
      );
      queryClient.invalidateQueries({ queryKey: characterKeys.lists() });
    },
  });
}

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

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { lorebooksService } from "@/services";
import { Lorebook } from "@storyforge/shared";

const FIVE_MINUTES = 5 * 60 * 1000;

export const lorebookKeys = {
  all: ["lorebooks"] as const,
  lists: () => [...lorebookKeys.all, "list"] as const,
  list: (filters: Record<string, unknown>) =>
    [...lorebookKeys.lists(), filters] as const,
  details: () => [...lorebookKeys.all, "detail"] as const,
  detail: (id: string) => [...lorebookKeys.details(), id] as const,
};

export function useLorebooks() {
  return useQuery({
    queryKey: lorebookKeys.lists(),
    queryFn: () => lorebooksService.getAll(),
    staleTime: FIVE_MINUTES,
  });
}

export function useLorebook(id: string) {
  return useQuery({
    queryKey: lorebookKeys.detail(id),
    queryFn: () => lorebooksService.getById(id),
    enabled: !!id,
    staleTime: FIVE_MINUTES,
  });
}

export function useCreateLorebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (lorebook: Omit<Lorebook, "id">) =>
      lorebooksService.create(lorebook),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: lorebookKeys.lists() });
    },
  });
}

export function useUpdateLorebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      lorebook,
    }: {
      id: string;
      lorebook: Partial<Lorebook>;
    }) => lorebooksService.update(id, lorebook),
    onSuccess: (updatedLorebook) => {
      queryClient.setQueryData(
        lorebookKeys.detail(updatedLorebook.id),
        updatedLorebook
      );
      queryClient.invalidateQueries({ queryKey: lorebookKeys.lists() });
    },
  });
}

export function useDeleteLorebook() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => lorebooksService.delete(id),
    onSuccess: (_, deletedId) => {
      queryClient.removeQueries({ queryKey: lorebookKeys.detail(deletedId) });
      queryClient.invalidateQueries({ queryKey: lorebookKeys.lists() });
    },
  });
}

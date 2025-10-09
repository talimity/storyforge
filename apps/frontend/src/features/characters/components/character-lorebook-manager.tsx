import { Card, HStack, IconButton, Spinner, Stack, Text, VStack } from "@chakra-ui/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LuTrash2 } from "react-icons/lu";
import {
  LorebookMultiSelect,
  type LorebookSelectItem,
} from "@/features/lorebooks/components/lorebook-selector";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";

type CharacterLorebookManagerProps = {
  characterId: string;
};

export function CharacterLorebookManager({ characterId }: CharacterLorebookManagerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const lorebooksQueryOptions = trpc.characterLorebooks.list.queryOptions(
    { id: characterId },
    { enabled: characterId.length > 0 }
  );

  const lorebooksQuery = useQuery(lorebooksQueryOptions);

  const invalidateLorebooks = () =>
    queryClient.invalidateQueries({ queryKey: lorebooksQueryOptions.queryKey });

  const linkMutation = useMutation(
    trpc.characterLorebooks.link.mutationOptions({
      onSuccess: async () => {
        await invalidateLorebooks();
        showSuccessToast({ title: "Lorebook linked" });
      },
      onError: (error) => {
        showErrorToast({ title: "Failed to link lorebook", error });
      },
    })
  );

  const unlinkMutation = useMutation(
    trpc.characterLorebooks.unlink.mutationOptions({
      onSuccess: async () => {
        await invalidateLorebooks();
        showSuccessToast({ title: "Lorebook unlinked" });
      },
      onError: (error) => {
        showErrorToast({ title: "Failed to unlink lorebook", error });
      },
    })
  );

  const handleAddLorebooks = (items: LorebookSelectItem[]) => {
    if (items.length === 0) return;
    void (async () => {
      for (const item of items) {
        await linkMutation.mutateAsync({ characterId, lorebookId: item.id });
      }
    })();
  };

  const handleRemoveLorebook = (lorebookId: string) => {
    unlinkMutation.mutate({ characterId, lorebookId });
  };

  const lorebooks = lorebooksQuery.data?.lorebooks ?? [];
  const isBusy = lorebooksQuery.isLoading || linkMutation.isPending || unlinkMutation.isPending;

  return (
    <Stack gap={4}>
      <LorebookMultiSelect onSelect={handleAddLorebooks} disabled={linkMutation.isPending} />

      {lorebooksQuery.isLoading ? (
        <Spinner size="sm" />
      ) : lorebooks.length === 0 ? (
        <Text color="content.muted" fontSize="sm">
          No lorebooks linked yet.
        </Text>
      ) : (
        <Stack gap={3}>
          {lorebooks.map((lorebook) => (
            <Card.Root key={lorebook.id} layerStyle="surface">
              <Card.Body>
                <HStack justify="space-between" align="flex-start">
                  <VStack align="flex-start" gap={0}>
                    <Text fontWeight="medium">{lorebook.name}</Text>
                    <Text color="content.muted" fontSize="sm">
                      {lorebook.entryCount} entries
                    </Text>
                  </VStack>
                  <IconButton
                    aria-label="Unlink lorebook"
                    size="sm"
                    variant="ghost"
                    colorPalette="red"
                    onClick={() => handleRemoveLorebook(lorebook.id)}
                    disabled={isBusy}
                  >
                    <LuTrash2 />
                  </IconButton>
                </HStack>
              </Card.Body>
            </Card.Root>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

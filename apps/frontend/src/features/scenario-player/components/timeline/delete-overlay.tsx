import { Box, HStack, Stack, Text } from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { useScenarioDataInvalidator } from "@/features/scenario-player/hooks/use-scenario-data-invalidator";
import { showErrorToast, showSuccessToast } from "@/lib/error-handling";
import { useTRPC } from "@/lib/trpc";
import { useTurnUiStore } from "../../stores/turn-ui-store";

interface DeleteOverlayProps {
  turnId: string;
}

export function DeleteOverlay({ turnId }: DeleteOverlayProps) {
  const trpc = useTRPC();
  const { invalidateCore } = useScenarioDataInvalidator();
  const closeOverlay = useTurnUiStore((state) => state.closeOverlay);

  const { mutate: deleteTurn, isPending } = useMutation(
    trpc.timeline.deleteTurn.mutationOptions({
      onError: (error) => {
        showErrorToast({ title: "Failed to delete turn", error });
      },
      onSuccess: (_data, variables) => {
        showSuccessToast({ title: "Turn deleted" });
        void invalidateCore();
        closeOverlay(variables.turnId);
      },
    })
  );

  return (
    <Box
      position="absolute"
      inset={0}
      display="flex"
      alignItems="center"
      justifyContent="center"
      bg="blackAlpha.700"
      borderRadius="md"
      zIndex={1}
      pointerEvents="auto"
      data-testid="delete-overlay"
    >
      <Box layerStyle="surface" borderRadius="md" p={4} width="100%" maxW="xs" boxShadow="lg">
        <Stack gap={3} align="flex-start">
          <Stack gap={1} align="flex-start">
            <Text fontWeight="bold">Delete Turn</Text>
            <Text fontSize="sm" color="content.muted">
              Choose what to remove. You can clear just this turn or cascade down the branch.
            </Text>
          </Stack>
          <HStack gap={2} flexWrap="wrap">
            <Button
              size="xs"
              variant="outline"
              onClick={() => deleteTurn({ turnId, cascade: false })}
              disabled={isPending}
              loading={isPending}
            >
              This turn only
            </Button>
            <Button
              size="xs"
              variant="outline"
              onClick={() => deleteTurn({ turnId, cascade: true })}
              disabled={isPending}
              loading={isPending}
            >
              This turn + children
            </Button>
            <Button size="xs" variant="outline" disabled>
              All alternates (soon)
            </Button>
          </HStack>
          <Button
            size="xs"
            variant="ghost"
            onClick={() => closeOverlay(turnId)}
            disabled={isPending}
          >
            Cancel
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

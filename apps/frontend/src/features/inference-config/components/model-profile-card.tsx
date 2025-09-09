import {
  Badge,
  Card,
  HStack,
  IconButton,
  Menu,
  Portal,
  Skeleton,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ModelProfile } from "@storyforge/contracts";
import type { TextInferenceCapabilities } from "@storyforge/inference";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { LuCog, LuEllipsisVertical, LuPencilLine, LuTrash } from "react-icons/lu";
import { useTRPC } from "@/lib/trpc";
import { DeleteModelProfileDialog } from "./delete-model-profile-dialog";
import { EditModelProfileDialog } from "./edit-model-profile-dialog";
import { TestConnectionButton } from "./test-connection-button";

interface ModelProfileCardProps {
  modelProfile: ModelProfile;
}

function getCapabilityBadges(capabilities: Partial<TextInferenceCapabilities> | null) {
  if (!capabilities) return [];

  const badges = [];
  if (capabilities.streaming) badges.push({ label: "Streaming", color: "blue" });
  if (capabilities.assistantPrefill) badges.push({ label: "Prefill", color: "green" });
  if (capabilities.tools) badges.push({ label: "Tools", color: "orange" });
  if (capabilities.fim) badges.push({ label: "FIM", color: "teal" });

  return badges;
}

export function ModelProfileCard({ modelProfile }: ModelProfileCardProps) {
  const trpc = useTRPC();
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const providerQuery = useQuery(
    trpc.providers.getProvider.queryOptions(
      { id: modelProfile.providerId },
      { enabled: !!modelProfile.providerId }
    )
  );

  const provider = providerQuery.data;
  const capabilities = modelProfile.capabilityOverrides;
  const capabilityBadges = getCapabilityBadges(capabilities);

  return (
    <>
      <Card.Root layerStyle="surface">
        <Card.Body p={4}>
          <VStack align="stretch" gap={3}>
            <HStack justify="space-between">
              <HStack gap={2}>
                <Text fontWeight="medium" truncate>
                  {modelProfile.displayName}
                </Text>
              </HStack>
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <IconButton variant="ghost" size="sm">
                    <LuEllipsisVertical />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item value="edit" onClick={() => setIsEditDialogOpen(true)}>
                        <LuPencilLine />
                        Edit
                      </Menu.Item>
                      <Menu.Item
                        value="delete"
                        onClick={() => setIsDeleteDialogOpen(true)}
                        color="red.500"
                      >
                        <LuTrash />
                        Delete
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            </HStack>

            <VStack align="stretch" gap={2}>
              <Text fontSize="sm" color="content.muted" truncate>
                Model: {modelProfile.modelId} (ID {modelProfile.id})
              </Text>

              {provider && (
                <HStack gap={2} align="center" justify="space-between">
                  <HStack gap={2} align="center">
                    <LuCog size={12} />
                    <Text fontSize="xs" color="content.muted" truncate>
                      {provider.name}
                    </Text>
                  </HStack>
                  <TestConnectionButton
                    providerId={modelProfile.providerId}
                    modelProfileId={modelProfile.id}
                  />
                </HStack>
              )}

              {capabilityBadges.length > 0 && (
                <Stack direction="row" gap={1} wrap="wrap">
                  {capabilityBadges.map((badge) => (
                    <Badge key={badge.label} colorPalette={badge.color} size="xs">
                      {badge.label}
                    </Badge>
                  ))}
                </Stack>
              )}
            </VStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      <EditModelProfileDialog
        modelProfile={modelProfile}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <DeleteModelProfileDialog
        modelProfile={modelProfile}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  );
}

export function ModelProfileCardSkeleton() {
  return (
    <Card.Root layerStyle="surface">
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Skeleton height="5" width="60%" />
            <Skeleton height="8" width="8" borderRadius="md" />
          </HStack>
          <VStack align="stretch" gap={2}>
            <Skeleton height="4" width="80%" />
            <Skeleton height="3" width="50%" />
            <HStack gap={1}>
              <Skeleton height="4" width="60px" borderRadius="sm" />
              <Skeleton height="4" width="50px" borderRadius="sm" />
            </HStack>
          </VStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

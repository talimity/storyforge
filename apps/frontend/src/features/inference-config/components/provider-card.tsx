import {
  Badge,
  Card,
  HStack,
  IconButton,
  Menu,
  Portal,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ProviderConfig } from "@storyforge/contracts";
import { useState } from "react";
import { LuEllipsisVertical, LuKey, LuPencilLine, LuTrash } from "react-icons/lu";
import { DeleteProviderDialog } from "./delete-provider-dialog";
import { EditProviderDialog } from "./edit-provider-dialog";

interface ProviderCardProps {
  provider: ProviderConfig;
}

function getProviderBadgeColor(kind: string) {
  switch (kind) {
    case "openrouter":
      return "blue";
    case "deepseek":
      return "purple";
    case "openai-compatible":
      return "green";
    default:
      return "gray";
  }
}

export function ProviderCard({ provider }: ProviderCardProps) {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  return (
    <>
      <Card.Root layerStyle="surface">
        <Card.Body p={4}>
          <VStack align="stretch" gap={3}>
            <HStack justify="space-between">
              <HStack gap={2}>
                <Text fontWeight="medium" truncate>
                  {provider.name}
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
              <Badge
                colorPalette={getProviderBadgeColor(provider.kind)}
                size="sm"
                alignSelf="start"
              >
                {provider.kind}
              </Badge>

              {provider.baseUrl && (
                <Text fontSize="xs" color="content.muted" truncate>
                  {provider.baseUrl}
                </Text>
              )}

              <HStack justify="space-between" align="center">
                <HStack gap={1} align="center">
                  <LuKey size={12} />
                  <Text fontSize="xs" color="content.muted">
                    {provider.auth.hasApiKey ? "API key configured" : "No API key"}
                  </Text>
                </HStack>
              </HStack>
            </VStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      <EditProviderDialog
        provider={provider}
        isOpen={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
      />

      <DeleteProviderDialog
        provider={provider}
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      />
    </>
  );
}

export function ProviderCardSkeleton() {
  return (
    <Card.Root layerStyle="surface">
      <Card.Body p={4}>
        <VStack align="stretch" gap={3}>
          <HStack justify="space-between">
            <Skeleton height="5" width="60%" />
            <Skeleton height="8" width="8" borderRadius="md" />
          </HStack>
          <VStack align="stretch" gap={2}>
            <Skeleton height="5" width="80px" borderRadius="sm" />
            <Skeleton height="3" width="70%" />
            <HStack justify="space-between">
              <Skeleton height="3" width="100px" />
              <Skeleton height="6" width="60px" borderRadius="sm" />
            </HStack>
          </VStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

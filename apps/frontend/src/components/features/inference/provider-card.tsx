import {
  Badge,
  Card,
  HStack,
  IconButton,
  MenuContent,
  MenuItem,
  MenuRoot,
  MenuTrigger,
  Skeleton,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ProviderConfig } from "@storyforge/schemas";
import { useState } from "react";
import {
  FaCloud,
  FaEllipsisVertical,
  FaGear,
  FaKey,
  FaPenToSquare,
  FaPlug,
  FaServer,
  FaTrash,
} from "react-icons/fa6";
import { DeleteProviderDialog } from "./delete-provider-dialog";
import { EditProviderDialog } from "./edit-provider-dialog";
import { TestConnectionButton } from "./test-connection-button";

interface ProviderCardProps {
  provider: ProviderConfig;
}

function getProviderIcon(kind: string) {
  switch (kind) {
    case "openrouter":
      return <FaCloud />;
    case "deepseek":
      return <FaServer />;
    case "openai-compatible":
      return <FaPlug />;
    default:
      return <FaGear />;
  }
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
                {getProviderIcon(provider.kind)}
                <Text fontWeight="medium" truncate>
                  {provider.name}
                </Text>
              </HStack>
              <MenuRoot>
                <MenuTrigger asChild>
                  <IconButton variant="ghost" size="sm">
                    <FaEllipsisVertical />
                  </IconButton>
                </MenuTrigger>
                <MenuContent>
                  <MenuItem
                    value="edit"
                    onClick={() => setIsEditDialogOpen(true)}
                  >
                    <FaPenToSquare />
                    Edit
                  </MenuItem>
                  <MenuItem
                    value="delete"
                    onClick={() => setIsDeleteDialogOpen(true)}
                    color="red.500"
                  >
                    <FaTrash />
                    Delete
                  </MenuItem>
                </MenuContent>
              </MenuRoot>
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
                  <FaKey size={12} />
                  <Text fontSize="xs" color="content.muted">
                    {provider.auth.hasApiKey
                      ? "API key configured"
                      : "No API key"}
                  </Text>
                </HStack>
                <TestConnectionButton providerId={provider.id} />
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

import {
  Badge,
  Box,
  Card,
  HStack,
  IconButton,
  Menu,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ScenarioWithCharacters } from "@storyforge/schemas";
import {
  LuCalendar,
  LuEllipsisVertical,
  LuHourglass,
  LuPencilLine,
  LuPlay,
  LuTrash,
  LuUsers,
} from "react-icons/lu";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/index";
import { CharacterPile } from "@/features/characters/components/character-pile";
import { ScenarioDeleteDialog } from "@/features/scenarios/components/scenario-delete-dialog";
import { useScenarioActions } from "@/features/scenarios/hooks/use-scenario-actions";
import { formatCount, formatDate } from "@/lib/formatting";

interface ScenarioCardProps {
  scenario: ScenarioWithCharacters;
  readOnly?: boolean;
}

export function ScenarioCard({ scenario, readOnly }: ScenarioCardProps) {
  const navigate = useNavigate();
  const {
    isDeleteDialogOpen,
    deleteScenarioMutation,
    handleDelete,
    handleEdit,
    openDeleteDialog,
    closeDeleteDialog,
  } = useScenarioActions(scenario.id);

  const handlePlay = () => {
    navigate(`/play/${scenario.id}`);
  };

  return (
    <Card.Root
      layerStyle="surface"
      transition="all 0.2s"
      className={!readOnly ? "group" : undefined}
    >
      <Card.Body p={6}>
        <VStack align="start" gap={4}>
          {/* Header */}
          <VStack align="start" gap={2} width="100%">
            <HStack justify="space-between" width="100%">
              <Text
                fontSize="lg"
                fontWeight="semibold"
                color="content.emphasized"
              >
                {scenario.name}
              </Text>
              <Badge
                colorPalette={scenario.status === "active" ? "green" : "gray"}
                variant="solid"
              >
                {scenario.status}
              </Badge>
            </HStack>

            {scenario.description && (
              <Text fontSize="sm" color="content.muted" lineClamp={3} minH={12}>
                {scenario.description}
              </Text>
            )}
          </VStack>

          {/* Characters */}
          <VStack align="start" gap={2} width="100%">
            <HStack gap={2}>
              <LuUsers size={14} />
              <Text fontSize="sm" color="content.muted">
                {formatCount(scenario.characters.length, "character")}
              </Text>
            </HStack>
            <CharacterPile
              characters={scenario.characters.map(
                (participant) => participant.character
              )}
              maxAvatars={5}
              spaceX={0.5}
              size="lg"
              layerStyle="surface"
              shape="rounded"
            />
          </VStack>

          {/* Metadata */}
          <HStack justify="space-between" width="100%" pt={2}>
            <HStack gap={2}>
              <LuCalendar size={14} />
              <Text fontSize="xs" color="content.muted">
                Created {formatDate(scenario.createdAt)}
              </Text>
            </HStack>
            <HStack gap={2}>
              <LuHourglass size={14} />
              <Text fontSize="xs" color="content.muted">
                {`${0} turns`}
              </Text>
            </HStack>
          </HStack>

          {/* Actions */}
          <HStack gap={2} width="100%" pt={2}>
            <Button
              variant="solid"
              colorPalette="primary"
              size="sm"
              flex={1}
              onClick={handlePlay}
            >
              <LuPlay />
              Play
            </Button>
            {!readOnly && (
              <Menu.Root positioning={{ placement: "bottom-end" }}>
                <Menu.Trigger asChild>
                  <IconButton
                    aria-label="Scenario options"
                    variant="outline"
                    size="sm"
                    colorPalette="neutral"
                  >
                    <LuEllipsisVertical />
                  </IconButton>
                </Menu.Trigger>
                <Portal>
                  <Menu.Positioner>
                    <Menu.Content>
                      <Menu.Item value="edit" onClick={handleEdit}>
                        <LuPencilLine />
                        <Box flex="1">Edit</Box>
                      </Menu.Item>
                      <Menu.Item
                        value="delete"
                        color="fg.error"
                        _hover={{ bg: "bg.error", color: "fg.error" }}
                        onClick={openDeleteDialog}
                        disabled={deleteScenarioMutation.isPending}
                      >
                        <LuTrash />
                        <Box flex="1">Delete</Box>
                      </Menu.Item>
                    </Menu.Content>
                  </Menu.Positioner>
                </Portal>
              </Menu.Root>
            )}
          </HStack>
        </VStack>
      </Card.Body>
      {!readOnly && (
        <ScenarioDeleteDialog
          isOpen={isDeleteDialogOpen}
          onOpenChange={() => closeDeleteDialog()}
          scenarioName={scenario.name}
          onConfirmDelete={handleDelete}
          isDeleting={deleteScenarioMutation.isPending}
        />
      )}
    </Card.Root>
  );
}

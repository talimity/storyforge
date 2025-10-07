import {
  Box,
  Card,
  Heading,
  HStack,
  IconButton,
  Menu,
  Portal,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ScenarioWithCharacters } from "@storyforge/contracts";
import {
  LuCalendar,
  LuEllipsisVertical,
  LuHourglass,
  LuPencilLine,
  LuPlay,
  LuTrash,
} from "react-icons/lu";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/index";
import { CharacterPile } from "@/features/characters/components/character-pile";
import { ScenarioDeleteDialog } from "@/features/scenarios/components/scenario-delete-dialog";
import { useScenarioActions } from "@/features/scenarios/hooks/use-scenario-actions";
import { formatDate } from "@/lib/formatting";

interface ScenarioCardProps {
  scenario: ScenarioWithCharacters;
}

export function ScenarioCard({ scenario }: ScenarioCardProps) {
  const {
    isDeleteDialogOpen,
    deleteScenarioMutation,
    handleDelete,
    openDeleteDialog,
    closeDeleteDialog,
  } = useScenarioActions(scenario.id);

  return (
    <Card.Root layerStyle="surface">
      <Card.Header>
        <Heading size="lg" truncate>
          <Link to={`/scenarios/${scenario.id}/edit`}>{scenario.name}</Link>
        </Heading>
      </Card.Header>
      <Card.Body>
        <VStack align="start" gap={4}>
          {/* Characters */}
          <VStack align="start" gap={2} width="100%">
            <CharacterPile
              characters={scenario.characters.map((participant) => participant.character)}
              maxAvatars={3}
              spaceX={0.5}
              size="2xl"
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
            <Button variant="solid" colorPalette="primary" size="sm" flex={1} asChild>
              <Link to={`/play/${scenario.id}`}>
                <LuPlay />
                Play
              </Link>
            </Button>

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
                    <Menu.Item value="edit" asChild>
                      <Link to={`/scenarios/${scenario.id}/edit`}>
                        <LuPencilLine />
                        <Box flex="1">Edit</Box>
                      </Link>
                    </Menu.Item>
                    <Menu.Item
                      value="delete"
                      color="fg.error"
                      _hover={{ bg: "bg.error", color: "fg.error" }}
                      onSelect={openDeleteDialog}
                      disabled={deleteScenarioMutation.isPending}
                    >
                      <LuTrash />
                      <Box flex="1">Delete</Box>
                    </Menu.Item>
                  </Menu.Content>
                </Menu.Positioner>
              </Portal>
            </Menu.Root>
          </HStack>
        </VStack>
      </Card.Body>

      {/* Dialogs*/}
      <ScenarioDeleteDialog
        isOpen={isDeleteDialogOpen}
        onOpenChange={() => closeDeleteDialog()}
        scenarioName={scenario.name}
        onConfirmDelete={handleDelete}
        isDeleting={deleteScenarioMutation.isPending}
      />
    </Card.Root>
  );
}

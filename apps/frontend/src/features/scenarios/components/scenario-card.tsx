import {
  Box,
  Card,
  Flex,
  Heading,
  HStack,
  IconButton,
  Menu,
  Portal,
  Skeleton,
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
import { useInView } from "react-intersection-observer";
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

  // defer mounting heavy chakra components until in view
  const { ref, inView } = useInView({ triggerOnce: true, rootMargin: "200px" });

  return (
    <Card.Root layerStyle="surface" ref={ref}>
      <Card.Header>
        <Heading size="lg" truncate>
          <Link to={`/scenarios/${scenario.id}/edit`}>{scenario.name}</Link>
        </Heading>
      </Card.Header>
      <Card.Body>
        <VStack align="start" gap={4}>
          {/* Characters */}
          {inView ? (
            <CharacterPile
              characters={scenario.characters.map((participant) => participant.character)}
              maxAvatars={3}
              spaceX={0.5}
              size="2xl"
              layerStyle="surface"
              shape="rounded"
            />
          ) : (
            <Flex>
              {scenario.characters.map((c) => (
                <Skeleton key={`av_${c.id}`} w="64px" h="64px" rounded="md" />
              ))}
            </Flex>
          )}

          {/* Metadata */}
          <HStack justify="space-between" width="full">
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
          <HStack gap={2} width="full">
            <Button variant="solid" colorPalette="primary" size="sm" flex={1} asChild>
              <Link to={`/play/${scenario.id}`}>
                <LuPlay />
                Play
              </Link>
            </Button>

            {inView ? (
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
            ) : (
              <Skeleton w="9" h="8" rounded="md" />
            )}
          </HStack>
        </VStack>
      </Card.Body>

      {/* Dialogs*/}
      {inView && (
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

export function ScenarioCardSkeleton() {
  return (
    <Card.Root variant="outline">
      <Card.Header>
        <Heading size="lg">
          <Skeleton w="60%" h="8" rounded="md" />
        </Heading>
      </Card.Header>
      <Card.Body>
        <VStack align="start" gap={4}>
          <Flex gap={2}>
            <Skeleton w="64px" h="64px" rounded="md" />
            <Skeleton w="64px" h="64px" rounded="md" />
          </Flex>

          <HStack justify="space-between" width="100%">
            <Skeleton w="50%" h="4" rounded="md" />
            <Skeleton w="20%" h="4" rounded="md" />
          </HStack>

          <HStack gap={2} width="full">
            <Skeleton flex={1} h="8" rounded="md" />
            <Skeleton w="15%" h="8" rounded="md" />
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

import {
  Avatar,
  AvatarGroup,
  Badge,
  Card,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { ScenarioWithCharacters } from "@storyforge/api";
import {
  LuCalendar,
  LuHourglass,
  LuPencilLine,
  LuPlay,
  LuUsers,
} from "react-icons/lu";
import { Button } from "@/components/ui";
import { getApiUrl } from "@/lib/trpc";
import { formatCount, formatDate } from "@/lib/utils/formatting";

interface ScenarioCardProps {
  scenario: ScenarioWithCharacters;
  readOnly?: boolean;
}

export function ScenarioCard({ scenario, readOnly }: ScenarioCardProps) {
  return (
    <Card.Root
      layerStyle="surface"
      variant="elevated"
      _hover={
        !readOnly ? { layerStyle: "interactive", shadow: "md" } : undefined
      }
      transition="all 0.2s"
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
          {scenario.characters?.length > 0 && (
            <VStack align="start" gap={2} width="100%">
              <HStack gap={2}>
                <LuUsers size={14} />
                <Text fontSize="sm" color="content.muted">
                  {formatCount(scenario.characters.length, "character")}
                </Text>
              </HStack>
              <AvatarGroup spaceX={0} size="lg">
                {scenario.characters
                  .filter((assignment) => assignment.isActive)
                  .map((assignment) => (
                    <Avatar.Root
                      key={assignment.character.id}
                      title={assignment.character.name}
                      // size="md"
                      shape="rounded"
                    >
                      {assignment.character.avatarPath && (
                        <Avatar.Image
                          src={getApiUrl(assignment.character.avatarPath)}
                        />
                      )}
                      <Avatar.Fallback>
                        {assignment.character.name.slice(0, 2).toUpperCase()}
                      </Avatar.Fallback>
                    </Avatar.Root>
                  ))}
              </AvatarGroup>
            </VStack>
          )}

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
              disabled
            >
              <LuPlay />
              Play
            </Button>
            <Button variant="outline" colorPalette="neutral" size="sm" disabled>
              <LuPencilLine />
              Edit
            </Button>
          </HStack>
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}

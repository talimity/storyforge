import {
  Box,
  Card,
  Heading,
  HStack,
  SegmentGroup,
  Skeleton,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react";
import { useEffect, useState } from "react";
import { RiQuillPenLine } from "react-icons/ri";
import { Navigate, useParams } from "react-router-dom";
import { PlayerLayout } from "@/components/features/player/player-layout";
import { Button } from "@/components/ui";
import { useActiveScenario } from "@/lib/hooks/use-active-scenario";
import { trpc } from "@/lib/trpc";

type InputMode = "direct" | "constraints" | "quick";

export function PlayerPage() {
  const { id } = useParams<{ id: string }>();
  const { setActiveScenario, clearActiveScenario } = useActiveScenario();
  const [inputMode, setInputMode] = useState<InputMode>("direct");
  const [inputText, setInputText] = useState("");

  // Fetch scenario data
  const scenarioQuery = trpc.scenarios.getById.useQuery(
    { id: id as string },
    { enabled: !!id }
  );

  // Set this scenario as active when the page loads successfully
  useEffect(() => {
    if (id && scenarioQuery.data) {
      setActiveScenario(id);
    }
  }, [id, scenarioQuery.data, setActiveScenario]);

  // Clear active scenario if the scenario doesn't exist
  useEffect(() => {
    if (scenarioQuery.error) {
      clearActiveScenario();
    }
  }, [scenarioQuery.error, clearActiveScenario]);

  if (!id) {
    return <Navigate to="/scenarios" replace />;
  }

  if (scenarioQuery.isLoading) {
    return (
      <PlayerLayout
        turnHistory={
          <Stack gap={4}>
            <Skeleton height="100px" borderRadius="md" />
            <Skeleton height="80px" borderRadius="md" />
            <Skeleton height="120px" borderRadius="md" />
          </Stack>
        }
        intentPanel={<Skeleton height="100px" borderRadius="md" />}
      />
    );
  }

  if (scenarioQuery.error || !scenarioQuery.data) {
    return <Navigate to="/scenarios" replace />;
  }

  // const _scenario = scenarioQuery.data;

  const turnHistory = (
    <Stack gap={6}>
      {/* ChapterHeader component */}
      <Box textAlign="center" py={8}>
        <Heading size="lg" mb={2}>
          Chapter One
        </Heading>
      </Box>

      {/* Turn component */}
      <Card.Root layerStyle="surfaceMuted">
        <Card.Body>
          <HStack mb={2} justify="space-between">
            <Text fontSize="xs" fontWeight="semibold">
              Narrator
            </Text>
            <Text fontSize="xs" color="content.muted">
              Turn 1 • 08:00 PM
            </Text>
          </HStack>
          <Text>
            The gaslight flickers in the dim corridor beneath the Paris Opera
            House. Strange melodies echo from the shadows, growing stronger as
            the evening rehearsal begins above.
          </Text>
        </Card.Body>
      </Card.Root>

      <Card.Root layerStyle="surfaceMuted">
        <Card.Body>
          <HStack mb={2} justify="space-between">
            <Text fontSize="xs" fontWeight="semibold">
              The Phantom
            </Text>
            <Text fontSize="xs" color="content.muted">
              Turn 2 • 08:05 PM
            </Text>
          </HStack>
          <Text fontStyle="italic">
            From the darkness, a figure emerges. His presence fills the corridor
            with an otherworldly chill. "Tonight, the opera shall witness true
            artistry," he whispers, his voice carrying both promise and threat.
          </Text>
        </Card.Body>
      </Card.Root>

      <Card.Root layerStyle="surfaceMuted">
        <Card.Body>
          <HStack mb={2} justify="space-between">
            <Text fontSize="xs" fontWeight="semibold">
              Christine
            </Text>
            <Text fontSize="xs" color="content.muted">
              Turn 3 • 08:07 PM
            </Text>
          </HStack>
          <Text>
            Christine pauses at the top of the stairs, sensing something amiss.
            Her hand grips the banister as she calls out hesitantly, "Is someone
            there? The rehearsal is about to begin..."
          </Text>
        </Card.Body>
      </Card.Root>
    </Stack>
  );

  const intentPanel = (
    <Stack gap={2}>
      {/* Input Mode Selector */}
      <SegmentGroup.Root
        value={inputMode}
        onValueChange={(e) => setInputMode(e.value as InputMode)}
        size="sm"
      >
        <SegmentGroup.Item value="direct">Direct Control</SegmentGroup.Item>
        <SegmentGroup.Item value="constraints">
          Story Constraints
        </SegmentGroup.Item>
        <SegmentGroup.Item value="quick">Quick Actions</SegmentGroup.Item>
      </SegmentGroup.Root>

      {/* Player Input Area */}
      {inputMode === "direct" && (
        <Stack gap={3}>
          <HStack>
            <Text fontSize="xs" color="content.muted">
              Speaking as:
            </Text>
            <Text fontSize="xs" fontWeight="semibold">
              Christine
            </Text>
          </HStack>
          <HStack gap={2} align="flex-end">
            <Textarea
              placeholder="Enter Christine's action or dialogue..."
              variant="onContrast"
              autoresize
              rows={2}
              maxH={40}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <Button colorPalette="accent" size="md">
              <RiQuillPenLine />
              Generate
            </Button>
          </HStack>
        </Stack>
      )}

      {inputMode === "constraints" && (
        <Stack gap={3}>
          <HStack>
            <Text fontSize="xs" color="content.muted">
              Constraint type:
            </Text>
            <Text fontSize="xs" fontWeight="semibold">
              Plot Development
            </Text>
          </HStack>
          <HStack gap={2} align="flex-end">
            <Textarea
              placeholder="Describe what should happen next..."
              size="sm"
              resize="vertical"
              autoresize
              rows={2}
              maxH={32}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              flex="1"
            />
            <Button colorScheme="primary" variant="solid" size="sm">
              <RiQuillPenLine />
              Generate
            </Button>
          </HStack>
        </Stack>
      )}

      {inputMode === "quick" && (
        <HStack gap={2} wrap="wrap">
          <Button variant="outline" size="sm">
            Plot Twist
          </Button>
          <Button variant="outline" size="sm">
            Surprise Me
          </Button>
          <Button variant="outline" size="sm">
            Jump Ahead
          </Button>
          <Button variant="outline" size="sm">
            Continue
          </Button>
        </HStack>
      )}
    </Stack>
  );

  return <PlayerLayout turnHistory={turnHistory} intentPanel={intentPanel} />;
}

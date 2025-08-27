import {
  Box,
  Card,
  Container,
  Grid,
  Heading,
  HStack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/prompt-renderer";
import type React from "react";
import { LuBookOpen, LuBrain, LuPenTool } from "react-icons/lu";
import { Link, useNavigate } from "react-router-dom";
import { Button, SimplePageHeader } from "@/components/ui";

interface TaskOption {
  value: TaskKind;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}

const taskOptions: TaskOption[] = [
  {
    value: "turn_generation",
    label: "Turn Generation",
    description:
      "Create templates for generating narrative turns and story progression",
    icon: LuBrain,
  },
  {
    value: "chapter_summarization",
    label: "Chapter Summarization",
    description: "Build templates for summarizing completed story chapters",
    icon: LuBookOpen,
  },
  {
    value: "writing_assistant",
    label: "Writing Assistant",
    description:
      "Design templates for general writing assistance and text improvement",
    icon: LuPenTool,
  },
];

export function TemplateTaskSelectPage() {
  const navigate = useNavigate();

  return (
    <Container maxW="6xl">
      <SimplePageHeader title="Create Template" />
      <VStack gap={6} align="stretch">
        <VStack gap={2} align="center" textAlign="center">
          <Heading size="lg">Choose a Task Type</Heading>
          <Text color="content.muted" maxW="2xl">
            Templates are designed for specific AI tasks. Select the type of
            task this template will be used for.
          </Text>
        </VStack>

        <Grid templateColumns={{ base: "1fr", md: "repeat(3, 1fr)" }} gap={4}>
          {taskOptions.map((option) => {
            const Icon = option.icon;
            return (
              <Link
                key={option.value}
                to={`/templates/create?type=${option.value}`}
                style={{ textDecoration: "none" }}
              >
                <Card.Root
                  layerStyle="surface"
                  p={6}
                  cursor="pointer"
                  _hover={{ shadow: "md" }}
                  height="100%"
                >
                  <VStack gap={4} align="center" textAlign="center">
                    <Box p={3} bg="primary.50" borderRadius="lg">
                      <Icon size={32} />
                    </Box>
                    <VStack gap={2}>
                      <Heading size="md">{option.label}</Heading>
                      <Text color="content.muted" fontSize="sm">
                        {option.description}
                      </Text>
                    </VStack>
                  </VStack>
                </Card.Root>
              </Link>
            );
          })}
        </Grid>

        <HStack justify="center">
          <Button variant="ghost" onClick={() => navigate("/templates")}>
            Cancel
          </Button>
        </HStack>
      </VStack>
    </Container>
  );
}

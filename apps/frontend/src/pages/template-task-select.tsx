import { Box, Card, Grid, Heading, HStack, Text, VStack } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import type React from "react";
import { LuBookOpenText, LuFoldVertical, LuPenTool } from "react-icons/lu";
import { Link, useNavigate } from "react-router-dom";
import { Button, SimplePageHeader } from "@/components/ui";
import { PageContainer } from "@/components/ui/page-container";

interface TaskOption {
  value: TaskKind;
  label: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
}

const taskOptions: TaskOption[] = [
  {
    value: "turn_generation",
    label: "Story Progression",
    description: "Prompts used by characters to generate the next turn in a scenario",
    icon: LuBookOpenText,
  },
  {
    value: "chapter_summarization",
    label: "Chapter Summarization",
    description: "Prompts used to compact a chapter's turns into a summary",
    icon: LuFoldVertical,
  },
  {
    value: "writing_assistant",
    label: "Writing Assistant",
    description: "Prompts used to continue, rewrite, or enhance some input text",
    icon: LuPenTool,
  },
];

function TemplateTaskSelectPage() {
  const navigate = useNavigate();

  return (
    <PageContainer maxW="6xl">
      <SimplePageHeader title="Create Prompt Template" />
      <VStack gap={6} align="stretch">
        <VStack gap={2} align="center" textAlign="center">
          <Heading size="lg">Choose a Task Type</Heading>
          <Text color="content.muted" maxW="2xl">
            Prompts are designed around specific generation tasks. The task you select affects what
            content blocks and variables are available when building your template.
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
    </PageContainer>
  );
}

export default TemplateTaskSelectPage;

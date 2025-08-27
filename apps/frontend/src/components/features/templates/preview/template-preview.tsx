import {
  Box,
  Card,
  Code,
  Heading,
  HStack,
  Icon,
  Stack,
  Text,
  VStack,
} from "@chakra-ui/react";
import type { PromptTemplate, SlotSpec } from "@storyforge/prompt-renderer";
import { LuBox, LuInfo, LuMessageCircle } from "react-icons/lu";
import type { TemplateDraft } from "@/components/features/templates/types";
import {
  compileDraft,
  validateDraft,
} from "@/components/features/templates/utils/compile-draft";

interface TemplatePreviewProps {
  draft: TemplateDraft;
}

export function TemplatePreview({ draft }: TemplatePreviewProps) {
  // Try to compile the draft to show the result
  let compiledTemplate: PromptTemplate | undefined;
  let compilationErrors: string[] = [];

  try {
    const validation = validateDraft(draft);
    if (validation.length === 0) {
      compiledTemplate = compileDraft(draft);
    } else {
      compilationErrors = validation;
    }
  } catch (error) {
    compilationErrors = [
      error instanceof Error ? error.message : "Unknown compilation error",
    ];
  }

  if (compilationErrors.length > 0) {
    return (
      <VStack align="stretch" gap={4}>
        <Box
          bg="red.50"
          border="1px solid"
          borderColor="red.200"
          p={4}
          borderRadius="md"
        >
          <HStack gap={2} mb={2}>
            <Icon as={LuInfo} color="red.500" />
            <Heading size="sm" color="red.700">
              Template Validation Errors
            </Heading>
          </HStack>
          <VStack align="start" gap={1}>
            {compilationErrors.map((error) => (
              <Text key={error} fontSize="sm" color="red.600">
                • {error}
              </Text>
            ))}
          </VStack>
        </Box>
        <Text color="content.muted" fontSize="sm">
          Fix the validation errors above to see the template preview.
        </Text>
      </VStack>
    );
  }

  if (!compiledTemplate) {
    return (
      <Text color="content.muted" fontSize="sm">
        Unable to generate preview.
      </Text>
    );
  }

  return (
    <VStack align="stretch" gap={6}>
      {/* Template Info */}
      <Card.Root layerStyle="surface">
        <Card.Body>
          <VStack align="stretch" gap={3}>
            <Heading size="md">Template Summary</Heading>
            <HStack justify="space-between" fontSize="sm">
              <Text fontWeight="medium">Task:</Text>
              <Text>
                {compiledTemplate.task
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </Text>
            </HStack>
            <HStack justify="space-between" fontSize="sm">
              <Text fontWeight="medium">Layout Nodes:</Text>
              <Text>{compiledTemplate.layout.length}</Text>
            </HStack>
            <HStack justify="space-between" fontSize="sm">
              <Text fontWeight="medium">Content Slots:</Text>
              <Text>{Object.keys(compiledTemplate.slots).length}</Text>
            </HStack>
          </VStack>
        </Card.Body>
      </Card.Root>

      {/* Layout Preview */}
      <Card.Root layerStyle="surface">
        <Card.Body>
          <VStack align="stretch" gap={4}>
            <Heading size="md">Template Structure</Heading>
            <Text color="content.muted" fontSize="sm">
              This shows how your template will be assembled for AI processing.
            </Text>

            <Stack gap={3}>
              {compiledTemplate.layout.map((node) => (
                <Box
                  key={`${node.kind}-${"name" in node ? node.name : Math.random()}`}
                >
                  {node.kind === "message" && (
                    <HStack gap={3} p={3} bg="surface.subtle" borderRadius="md">
                      <Icon as={LuMessageCircle} color="blue.500" />
                      <VStack align="start" gap={1} flex={1}>
                        <HStack gap={2}>
                          <Text fontWeight="medium" fontSize="sm">
                            {node.role.charAt(0).toUpperCase() +
                              node.role.slice(1)}{" "}
                            Message
                          </Text>
                          {"name" in node && node.name ? (
                            <Code fontSize="xs" colorPalette="gray">
                              {String(node.name)}
                            </Code>
                          ) : null}
                          {node.prefix && (
                            <Code fontSize="xs" colorPalette="blue">
                              prefix
                            </Code>
                          )}
                        </HStack>
                        {node.content && (
                          <Text
                            fontSize="sm"
                            color="content.muted"
                            fontFamily="mono"
                          >
                            {node.content.length > 100
                              ? `${node.content.slice(0, 100)}...`
                              : node.content}
                          </Text>
                        )}
                        {"from" in node && node.from ? (
                          <Code fontSize="xs" colorPalette="purple">
                            from: {String(node.from)}
                          </Code>
                        ) : null}
                      </VStack>
                    </HStack>
                  )}

                  {node.kind === "slot" && (
                    <HStack gap={3} p={3} bg="surface.subtle" borderRadius="md">
                      <Icon as={LuBox} color="green.500" />
                      <VStack align="start" gap={1} flex={1}>
                        <HStack gap={2}>
                          <Text fontWeight="medium" fontSize="sm">
                            Content Slot: {node.name}
                          </Text>
                          {node.omitIfEmpty && (
                            <Code fontSize="xs" colorPalette="orange">
                              hide when empty
                            </Code>
                          )}
                        </HStack>

                        {/* Show slot details */}
                        {compiledTemplate.slots[node.name] && (
                          <SlotPreview
                            slot={compiledTemplate.slots[node.name]}
                            slotName={node.name}
                          />
                        )}

                        {/* Show headers/footers */}
                        {node.header && (
                          <Text fontSize="xs" color="content.muted">
                            Header:{" "}
                            {Array.isArray(node.header)
                              ? `${node.header.length} messages`
                              : "1 message"}
                          </Text>
                        )}
                        {node.footer && (
                          <Text fontSize="xs" color="content.muted">
                            Footer:{" "}
                            {Array.isArray(node.footer)
                              ? `${node.footer.length} messages`
                              : "1 message"}
                          </Text>
                        )}
                      </VStack>
                    </HStack>
                  )}
                </Box>
              ))}
            </Stack>
          </VStack>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
}

interface SlotPreviewProps {
  slot: SlotSpec;
  slotName: string;
}

function SlotPreview({ slot, slotName }: SlotPreviewProps) {
  return (
    <VStack align="start" gap={1} fontSize="xs" color="content.muted">
      <Text>Priority: {slot.priority}</Text>
      {slot.budget?.maxTokens && (
        <Text>Budget: {slot.budget.maxTokens} tokens</Text>
      )}
      {slot.plan && slot.plan.length > 0 && (
        <Text>Plan steps: {slot.plan.length}</Text>
      )}
    </VStack>
  );
}

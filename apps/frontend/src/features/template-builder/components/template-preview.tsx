import { Card, Heading, HStack, List, Text, VStack } from "@chakra-ui/react";
import type { UnboundTemplate } from "@storyforge/prompt-rendering";
import { LuTriangleAlert } from "react-icons/lu";
import { Alert } from "@/components/ui/index";
import { compileDraft, validateDraft } from "@/features/template-builder/services/compile-draft";
import type { TemplateDraft } from "@/features/template-builder/types";

interface TemplatePreviewProps {
  draft: TemplateDraft;
}

export function TemplatePreview({ draft }: TemplatePreviewProps) {
  // Try to compile the draft to show the result
  let compiledTemplate: UnboundTemplate | undefined;
  let compilationErrors: string[] = [];

  try {
    const validation = validateDraft(draft);
    if (validation.length === 0) {
      compiledTemplate = compileDraft(draft);
    } else {
      compilationErrors = validation;
    }
  } catch (error) {
    compilationErrors = [error instanceof Error ? error.message : "Unknown compilation error"];
  }

  if (compilationErrors.length > 0) {
    return (
      <Alert
        icon={<LuTriangleAlert />}
        title={`Template has compilation issues (${compilationErrors.length})`}
        status="error"
      >
        <List.Root>
          {compilationErrors.map((error, index) => (
            <List.Item key={error + String(index)}>{error}</List.Item>
          ))}
        </List.Root>
        <Text fontSize="sm" mt={4}>
          Fix the errors above to see the template preview.
        </Text>
      </Alert>
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
                {compiledTemplate.task.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase())}
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
          <p>TODO: Implement layout preview</p>
          <ul>
            <li>Add scenario selector</li>
            <li>Add `templates.preview` procedure, accepting scenario ID</li>
            <li>Add template dry run service</li>
            <li>Dry run the template with the scenario</li>
            <li>Display the ChatCompletionMessage array here</li>
          </ul>
        </Card.Body>
      </Card.Root>
    </VStack>
  );
}

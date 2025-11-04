import { Card, HStack, Stack, Text, VStack } from "@chakra-ui/react";
import { LuCheck } from "react-icons/lu";
import { Button } from "@/components/ui";
import { getRecipeById } from "@/features/template-builder/services/recipe-registry";
import type { SlotBlockDraft } from "@/features/template-builder/services/template-import";

interface ImportBlockOptionListProps {
  blocks: SlotBlockDraft[];
  selectedBlockName: string | null;
  onSelect: (blockName: string) => void;
}

export function ImportBlockOptionList({
  blocks,
  selectedBlockName,
  onSelect,
}: ImportBlockOptionListProps) {
  if (blocks.length === 0) return null;

  return (
    <Stack gap={3}>
      {blocks.map((block) => {
        const isActive = selectedBlockName === block.slot.name;
        const recipe =
          block.slot.recipeId === "custom" ? undefined : getRecipeById(block.slot.recipeId);

        return (
          <Card.Root
            key={block.slot.name}
            layerStyle="surface"
            borderWidth={isActive ? "2px" : "1px"}
            borderColor={isActive ? "border.emphasized" : "border.subtle"}
            cursor="pointer"
            _hover={{ borderColor: "border.emphasized" }}
            onClick={() => onSelect(block.slot.name)}
          >
            <Card.Body>
              <HStack justify="space-between" align="start">
                <VStack align="start" gap={1}>
                  <Text fontWeight="medium">{block.slot.name}</Text>
                  <Text fontSize="xs" color="content.muted">
                    {recipe?.name ?? "Custom block"}
                  </Text>
                  <HStack fontSize="xs" color="content.subtle" gap={3}>
                    <Text>Priority: {block.slot.priority}</Text>
                    {typeof block.slot.budget === "number" && (
                      <Text>Budget: {block.slot.budget} tokens</Text>
                    )}
                  </HStack>
                </VStack>
                <Button
                  variant={isActive ? "solid" : "ghost"}
                  size="xs"
                  colorPalette={isActive ? "primary" : "neutral"}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelect(block.slot.name);
                  }}
                >
                  <LuCheck />
                  {isActive ? "Selected" : "Select"}
                </Button>
              </HStack>
            </Card.Body>
          </Card.Root>
        );
      })}
    </Stack>
  );
}

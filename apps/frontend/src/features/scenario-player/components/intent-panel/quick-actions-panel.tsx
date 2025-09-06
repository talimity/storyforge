import { HStack } from "@chakra-ui/react";
import { Button } from "@/components/ui/index";

interface QuickActionsPanelProps {
  isGenerating: boolean;
}

export function QuickActionsPanel({ isGenerating }: QuickActionsPanelProps) {
  // TODO
  return (
    <HStack gap={2} wrap="wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={() => undefined}
        disabled={isGenerating}
      >
        Continue
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => undefined}
        disabled={isGenerating}
      >
        Jump Ahead
      </Button>
    </HStack>
  );
}

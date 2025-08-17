import { HStack } from "@chakra-ui/react";
import { Button } from "@/components/ui";

interface QuickActionsPanelProps {
  onAction: (
    action: "plot_twist" | "surprise_me" | "jump_ahead" | "continue"
  ) => void;
  isGenerating: boolean;
}

export function QuickActionsPanel({
  onAction,
  isGenerating,
}: QuickActionsPanelProps) {
  return (
    <HStack gap={2} wrap="wrap">
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAction("plot_twist")}
        disabled={isGenerating}
      >
        Plot Twist
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAction("surprise_me")}
        disabled={isGenerating}
      >
        Surprise Me
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAction("jump_ahead")}
        disabled={isGenerating}
      >
        Jump Ahead
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => onAction("continue")}
        disabled={isGenerating}
      >
        Continue
      </Button>
    </HStack>
  );
}

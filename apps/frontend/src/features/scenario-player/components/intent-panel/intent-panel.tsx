import { HStack, SegmentGroup, Stack, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { Button } from "@/components/ui/index";
import { useBranchPreview } from "@/features/scenario-player/hooks/use-branch-preview";
import { DirectControlPanel } from "./direct-control-panel";
import { QuickActionsPanel } from "./quick-actions-panel";
import { StoryConstraintsPanel } from "./story-constraints-panel";

export type InputMode = "direct" | "constraints" | "quick";

interface IntentPanelProps {
  onSubmitIntent: (mode: InputMode, text: string) => Promise<void>;
  onCancelIntent: () => Promise<void> | void;
  onQuickContinue?: () => Promise<void> | void;
}

export function IntentPanel(props: IntentPanelProps) {
  const { onSubmitIntent, onCancelIntent, onQuickContinue } = props;
  const [inputMode, setInputMode] = useState<InputMode>("direct");
  const [inputText, setInputText] = useState("");
  const { previewLeafTurnId, commitPreview, isGenerating, exitPreview } = useBranchPreview();

  const handleGenerate = async () => {
    // TODO: This should only empty input if the intent was successfully
    // submitted, and should restore last input if the intent fails during
    // generation.
    if (!inputText.trim()) return;
    await onSubmitIntent(inputMode, inputText.trim());
  };

  // Preview mode: replace the entire panel with a message and buttons
  // to switch to the preview or go back to the main timeline, since we
  // cannot generate outside the active timeline.
  if (previewLeafTurnId) {
    return (
      <VStack gap={2} minH="100px" justify="center">
        <Text fontSize="sm" color="content.muted">
          You're viewing an alternate timeline for this scenario.
        </Text>
        <HStack gap={2}>
          <Button size="sm" colorPalette="accent" onClick={commitPreview} disabled={isGenerating}>
            Switch to this branch
          </Button>
          <Button size="sm" variant="ghost" onClick={exitPreview} disabled={isGenerating}>
            Go back
          </Button>
        </HStack>
      </VStack>
    );
  }

  return (
    <Stack gap={2}>
      {/* Input Mode Selector */}
      <SegmentGroup.Root
        value={inputMode}
        onValueChange={(e) => setInputMode(e.value as InputMode)}
        size="sm"
      >
        <SegmentGroup.Indicator />
        <SegmentGroup.Items
          items={[
            { value: "direct", label: "Direct Control" },
            { value: "constraints", label: "Story Constraints" },
            { value: "quick", label: "Quick Actions" },
          ]}
        />
      </SegmentGroup.Root>

      {/* Mode-specific panels */}
      {inputMode === "direct" && (
        <DirectControlPanel
          inputText={inputText}
          onInputChange={setInputText}
          onGenerate={handleGenerate}
          onCancel={onCancelIntent}
          isGenerating={isGenerating}
        />
      )}

      {inputMode === "constraints" && (
        <StoryConstraintsPanel
          inputText={inputText}
          onInputChange={setInputText}
          onGenerate={handleGenerate}
          onCancel={onCancelIntent}
          isGenerating={isGenerating}
        />
      )}

      {inputMode === "quick" && (
        <QuickActionsPanel isGenerating={isGenerating} onContinue={onQuickContinue} />
      )}
    </Stack>
  );
}

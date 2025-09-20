import { Box, HStack, SegmentGroup, Stack, Text, VStack } from "@chakra-ui/react";
import { useState } from "react";
import { Button } from "@/components/ui/index";
import { PromptInput } from "@/features/scenario-player/components/intent-panel/prompt-input";
import { useBranchPreview } from "@/features/scenario-player/hooks/use-branch-preview";
import { QuickActionsPanel } from "./quick-actions-panel";

export type InputMode = "direct" | "guided" | "constraints" | "quick";

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
    <Stack gap={0}>
      {/* Input Mode Selector */}
      <Box overflowX="auto" maxW="100%" pb={1}>
        <SegmentGroup.Root
          value={inputMode}
          onValueChange={(e) => setInputMode(e.value as InputMode)}
          size="xs"
        >
          <SegmentGroup.Indicator />
          <SegmentGroup.Items
            items={[
              { value: "direct", label: "Direct Control" },
              { value: "guided", label: "Guided Control" },
              { value: "constraints", label: "Story Constraints" },
              { value: "quick", label: "Quick Actions" },
            ]}
          />
        </SegmentGroup.Root>
      </Box>

      {/* Mode-specific panels */}
      {["direct", "guided"].includes(inputMode) && (
        <PromptInput
          withCharacterSelect
          inputText={inputText}
          onInputChange={setInputText}
          onGenerate={handleGenerate}
          onCancel={onCancelIntent}
          isGenerating={isGenerating}
        />
      )}

      {inputMode === "constraints" && (
        <PromptInput
          withCharacterSelect={false}
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

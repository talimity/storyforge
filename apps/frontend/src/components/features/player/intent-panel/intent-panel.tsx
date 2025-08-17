import { SegmentGroup, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { DirectControlPanel } from "./direct-control-panel";
import { QuickActionsPanel } from "./quick-actions-panel";
import { StoryConstraintsPanel } from "./story-constraints-panel";

export type InputMode = "direct" | "constraints" | "quick";

interface IntentPanelProps {
  selectedCharacterName: string | null;
  onSubmitIntent: (mode: InputMode, text: string) => Promise<void>;
  onQuickAction: (action: string) => Promise<void>;
  isGenerating: boolean;
}

export function IntentPanel({
  selectedCharacterName,
  onSubmitIntent,
  onQuickAction,
  isGenerating,
}: IntentPanelProps) {
  const [inputMode, setInputMode] = useState<InputMode>("direct");
  const [inputText, setInputText] = useState("");

  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    await onSubmitIntent(inputMode, inputText.trim());
    setInputText("");
  };

  const handleQuickAction = async (action: string) => {
    await onQuickAction(action);
  };

  return (
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

      {/* Mode-specific panels */}
      {inputMode === "direct" && (
        <DirectControlPanel
          selectedCharacterName={selectedCharacterName}
          inputText={inputText}
          onInputChange={setInputText}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      )}

      {inputMode === "constraints" && (
        <StoryConstraintsPanel
          inputText={inputText}
          onInputChange={setInputText}
          onGenerate={handleGenerate}
          isGenerating={isGenerating}
        />
      )}

      {inputMode === "quick" && (
        <QuickActionsPanel
          onAction={handleQuickAction}
          isGenerating={isGenerating}
        />
      )}
    </Stack>
  );
}

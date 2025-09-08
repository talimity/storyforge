import { SegmentGroup, Stack } from "@chakra-ui/react";
import { useState } from "react";
import { DirectControlPanel } from "./direct-control-panel";
import { QuickActionsPanel } from "./quick-actions-panel";
import { StoryConstraintsPanel } from "./story-constraints-panel";

export type InputMode = "direct" | "constraints" | "quick";

interface IntentPanelProps {
  onSubmitIntent: (mode: InputMode, text: string) => Promise<void>;
  isGenerating: boolean;
}

export function IntentPanel(props: IntentPanelProps) {
  const { onSubmitIntent, isGenerating } = props;
  const [inputMode, setInputMode] = useState<InputMode>("direct");
  const [inputText, setInputText] = useState("");

  const handleGenerate = async () => {
    // TODO: This should only empty input if the intent was successfully
    // submitted, and should restore last input if the intent fails during
    // generation.
    if (!inputText.trim()) return;
    await onSubmitIntent(inputMode, inputText.trim());
    setInputText("");
  };

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

      {inputMode === "quick" && <QuickActionsPanel isGenerating={isGenerating} />}
    </Stack>
  );
}

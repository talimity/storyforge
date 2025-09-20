import { Stack } from "@chakra-ui/react";
import { PromptInput } from "@/features/scenario-player/components/intent-panel/prompt-input";

interface CharacterControlPanelProps {
  onGenerate: () => void;
  onCancel: () => void;
  isGenerating: boolean;
}

export function CharacterControlPanel({
  onGenerate,
  onCancel,
  isGenerating,
}: CharacterControlPanelProps) {
  return (
    <Stack gap={3}>
      <PromptInput isGenerating={isGenerating} onGenerate={onGenerate} onCancel={onCancel} />
    </Stack>
  );
}

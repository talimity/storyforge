import { IconButton } from "@chakra-ui/react";
import { LuSquare } from "react-icons/lu";
import { RiQuillPenLine } from "react-icons/ri";
import type { Button } from "@/components/ui";

interface GenerateOrCancelButtonProps extends React.ComponentProps<typeof Button> {
  isGenerating: boolean;
  onGenerate: () => void | Promise<void>;
  onCancel: () => void | Promise<void>;
}

export function GenerateOrCancelButton({
  isGenerating,
  onGenerate,
  onCancel,
  children,
  ...buttonProps
}: GenerateOrCancelButtonProps) {
  return (
    <IconButton
      size="xs"
      boxSize="40px"
      onClick={isGenerating ? onCancel : onGenerate}
      {...buttonProps}
    >
      {isGenerating ? <LuSquare /> : <RiQuillPenLine />}
    </IconButton>
  );
}

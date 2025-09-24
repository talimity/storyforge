import { LuSquare } from "react-icons/lu";
import { RiQuillPenLine } from "react-icons/ri";
import { Button } from "@/components/ui";

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
  if (isGenerating) {
    return (
      <Button size="xs" onClick={onCancel} {...buttonProps}>
        <LuSquare />
      </Button>
    );
  }
  return (
    <Button size="xs" onClick={onGenerate} {...buttonProps}>
      <RiQuillPenLine />
    </Button>
  );
}

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
      <Button onClick={onCancel} {...buttonProps}>
        <LuSquare />
        Cancel
      </Button>
    );
  }
  return (
    <Button onClick={onGenerate} {...buttonProps}>
      <RiQuillPenLine />
      {children ?? "Generate"}
    </Button>
  );
}

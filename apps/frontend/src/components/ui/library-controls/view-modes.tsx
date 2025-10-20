import { SegmentGroup } from "@chakra-ui/react";
import type { ReactNode } from "react";

interface ViewModeOption {
  value: string;
  label: ReactNode;
}

interface ViewModesProps {
  options: ViewModeOption[];
  value?: string;
  onChange?: (value: string) => void;
}

export function ViewModes({ options, value, onChange }: ViewModesProps) {
  if (options.length === 0) {
    return null;
  }
  const fallbackValue = value ?? options[0]?.value ?? "";

  return (
    <SegmentGroup.Root
      value={fallbackValue}
      onValueChange={
        onChange
          ? (details) => {
              const nextValue = details.value;
              if (nextValue) {
                onChange(nextValue);
              }
            }
          : undefined
      }
    >
      <SegmentGroup.Indicator />
      <SegmentGroup.Items items={options} />
    </SegmentGroup.Root>
  );
}

import { Badge, createListCollection, HStack, Stack, Text } from "@chakra-ui/react";
import type { TaskKind } from "@storyforge/gentasks";
import { taskKindSchema } from "@storyforge/gentasks";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/index";

export type TaskKindOption = {
  value: TaskKind;
  label: string;
  description?: string;
};

export const taskKindOptions: readonly TaskKindOption[] = [
  {
    value: "turn_generation",
    label: "Turn Generation",
    description: "Generate narrative turns for story progression",
  },
  {
    value: "chapter_summarization",
    label: "Chapter Summarization",
    description: "Create summaries of completed story chapters",
  },
  {
    value: "writing_assistant",
    label: "Writing Assistant",
    description: "General writing assistance and text improvement",
  },
];

type BaseProps = {
  value: TaskKind | "";
  onChange: (value: TaskKind | "") => void;
  disabled?: boolean;
  placeholder?: string;
  /** If true, the dropdown is rendered without portalling to avoid z-index issues */
  inDialog?: boolean;
  /** Include an "All" option with empty-string value */
  includeAll?: boolean;
  /** Label to use for the "All" option */
  allLabel?: string;
};

export function TaskKindSelect({
  value,
  onChange,
  disabled = false,
  placeholder = "Select task kind",
  inDialog = false,
  includeAll = false,
  allLabel = "All Tasks",
}: BaseProps) {
  type AnyTaskItem = { value: TaskKind | ""; label: string; description?: string };
  const items: AnyTaskItem[] = includeAll
    ? [{ value: "", label: allLabel }, ...taskKindOptions]
    : [...taskKindOptions];

  const collection = createListCollection({ items });

  return (
    <SelectRoot
      collection={collection}
      value={value === undefined || value === null ? [] : [value]}
      onValueChange={(d) => {
        const raw = d.value[0];
        if (raw === undefined) return;
        const next = includeAll && raw === "" ? "" : taskKindSchema.parse(raw);
        onChange(next);
      }}
      disabled={disabled}
    >
      <SelectTrigger>
        <Stack direction="row" alignItems="center" gap={2}>
          <SelectValueText placeholder={placeholder} />
          {disabled && (
            <Badge size="sm" colorPalette="neutral">
              Read-only
            </Badge>
          )}
        </Stack>
      </SelectTrigger>
      <SelectContent portalled={!inDialog}>
        {items.map((opt) => (
          <SelectItem key={opt.value} item={opt}>
            {opt.description ? (
              <Stack gap={1}>
                <Text>{opt.label}</Text>
                <Text fontSize="xs" color="content.muted">
                  {opt.description}
                </Text>
              </Stack>
            ) : (
              <HStack>
                <Text>{opt.label}</Text>
              </HStack>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </SelectRoot>
  );
}

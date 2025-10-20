import { createListCollection, HStack, type SelectRootProps, Text } from "@chakra-ui/react";
import { type ReactNode, useMemo } from "react";
import { LuArrowUpDown } from "react-icons/lu";
import {
  SelectContent,
  SelectItem,
  SelectRoot,
  SelectTrigger,
  SelectValueText,
} from "@/components/ui/index";

interface SortOption {
  value: string;
  label: string;
}

type SortDropdownProps = {
  options: SortOption[];
  value?: string;
  onChange?: (value: string) => void;
  label?: ReactNode;
} & Omit<SelectRootProps, "collection" | "value" | "onChange" | "children">;

export function SortDropdown({
  options,
  value,
  onChange,
  label = <LuArrowUpDown />,
  ...selectProps
}: SortDropdownProps) {
  const collection = useMemo(() => createListCollection({ items: options }), [options]);
  const currentValue = value ?? options[0]?.value ?? "";
  const isDisabled = options.length === 0;

  return (
    <HStack flex="1" gap={1}>
      <Text fontWeight="medium" fontSize="sm">
        {label}
      </Text>
      <SelectRoot
        {...selectProps}
        minW="40"
        collection={collection}
        value={currentValue ? [currentValue] : []}
        onValueChange={(details) => {
          const nextValue = details.value[0];
          if (!nextValue) return;
          onChange?.(nextValue);
        }}
        disabled={isDisabled}
      >
        <SelectTrigger>
          <SelectValueText placeholder="Select sort" />
        </SelectTrigger>
        <SelectContent portalled>
          {options.map((option) => (
            <SelectItem key={option.value} item={option}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </SelectRoot>
    </HStack>
  );
}

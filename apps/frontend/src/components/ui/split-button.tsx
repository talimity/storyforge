import { type ButtonProps, For, Group, IconButton, Menu, Portal } from "@chakra-ui/react";
import { LuChevronDown } from "react-icons/lu";
import { Button } from "@/components/ui/button";

export interface SplitButtonProps {
  colorPalette?: ButtonProps["colorPalette"];
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  buttonLabel: string;
  menuItems: { label: string; value: string }[];
  onSelect?: Menu.RootProps["onSelect"];
  onClick?: ButtonProps["onClick"];
}

export const SplitButton = (props: SplitButtonProps) => {
  const { size, variant, onClick, colorPalette, buttonLabel, onSelect, menuItems } = props;

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }} onSelect={onSelect}>
      <Group attached colorPalette={colorPalette}>
        <Button variant={variant} size={size} onClick={onClick}>
          {buttonLabel}
        </Button>
        <Menu.Trigger asChild>
          <IconButton variant={variant} size={size}>
            <LuChevronDown />
          </IconButton>
        </Menu.Trigger>
      </Group>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <For each={menuItems}>
              {(item) => (
                <Menu.Item key={item.value} value={item.value}>
                  {item.label}
                </Menu.Item>
              )}
            </For>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

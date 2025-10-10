import { type ButtonProps, For, Group, IconButton, Menu, Portal } from "@chakra-ui/react";
import { useMemo, useRef } from "react";
import { LuChevronDown } from "react-icons/lu";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui";

export interface SplitButtonProps {
  colorPalette?: ButtonProps["colorPalette"];
  size?: ButtonProps["size"];
  variant?: ButtonProps["variant"];
  buttonLabel: string;
  menuItems: { label: string; value: string; path?: string }[];
  onSelect?: Menu.RootProps["onSelect"];
  onClick?: ButtonProps["onClick"];
}

export const SplitButton = (props: SplitButtonProps) => {
  const { size, variant, onClick, colorPalette, buttonLabel, onSelect, menuItems } = props;
  const triggerRef = useRef<HTMLButtonElement>(null);

  const onClickFn = useMemo(
    () =>
      onClick ||
      (() => {
        if (triggerRef.current) {
          triggerRef.current.click();
        }
      }),
    [onClick]
  );

  return (
    <Menu.Root positioning={{ placement: "bottom-end" }} onSelect={onSelect}>
      <Group attached colorPalette={colorPalette}>
        <Button variant={variant} size={size} onClick={onClickFn}>
          {buttonLabel}
        </Button>
        <Menu.Trigger asChild ref={triggerRef}>
          <IconButton variant={variant} size={size}>
            <LuChevronDown />
          </IconButton>
        </Menu.Trigger>
      </Group>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <For each={menuItems}>
              {(item) => {
                if (item.path) {
                  return (
                    <Menu.Item key={item.value} value={item.value} asChild>
                      <Link to={item.path}>{item.label}</Link>
                    </Menu.Item>
                  );
                }

                return (
                  <Menu.Item key={item.value} value={item.value}>
                    {item.label}
                  </Menu.Item>
                );
              }}
            </For>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  );
};

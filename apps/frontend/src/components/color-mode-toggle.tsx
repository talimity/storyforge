import { useTheme } from "next-themes";
import { LuMoon, LuSun } from "react-icons/lu";
import { Button } from "@/components/ui";

interface ColorModeToggleProps {
  collapsed?: boolean;
}

export function ColorModeToggle({ collapsed = false }: ColorModeToggleProps) {
  const { theme, setTheme } = useTheme();
  const toggleColorMode = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  return (
    <Button
      colorPalette="grey"
      variant="ghost"
      w="full"
      h="10"
      justifyContent={collapsed ? "center" : "start"}
      gap="3"
      verticalAlign="super"
      px={collapsed ? "2" : "4"}
      color="content.subtle"
      _hover={{
        bg: "surface.emphasized",
        color: "content.emphasized",
      }}
      transition="all 0.2s"
      overflow="hidden"
      onClick={toggleColorMode}
    >
      {theme === "light" ? <LuMoon /> : <LuSun />}
      {!collapsed && (theme === "light" ? "Dark Mode" : "Light Mode")}
    </Button>
  );
}

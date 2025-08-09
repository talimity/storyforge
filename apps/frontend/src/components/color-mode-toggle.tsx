import { Button } from "@chakra-ui/react";
import { useTheme } from "next-themes";
import { LuMoon, LuSun } from "react-icons/lu";

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
      variant="ghost"
      width="full"
      justifyContent="start"
      gap="3"
      px={collapsed ? "2" : "4"}
      color="fg.muted"
      _hover={{
        bg: "colorPalette.subtle",
        color: "colorPalette.fg",
      }}
      transition="all 0.2s"
      onClick={toggleColorMode}
      aria-label="toggle color mode"
    >
      <span style={{ fontSize: collapsed ? "20px" : "16px" }}>
        {theme === "light" ? <LuMoon /> : <LuSun />}
      </span>
      {!collapsed && (theme === "light" ? "Dark Mode" : "Light Mode")}
    </Button>
  );
}

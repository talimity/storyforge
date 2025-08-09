import { Button } from "@chakra-ui/react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { Tooltip } from "@/components/ui/tooltip";

interface SidebarLinkProps {
  to: string;
  icon: ReactNode;
  label: string;
  collapsed?: boolean;
}

export function SidebarLink({
  to,
  icon,
  label,
  collapsed = false,
}: SidebarLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  const linkContent = (
    <Button
      variant="ghost"
      w="full"
      h="10"
      justifyContent="start"
      gap="3"
      verticalAlign={"super"}
      px={collapsed ? "2" : "4"}
      color={isActive ? "colorPalette.fg" : "fg.muted"}
      bg={isActive ? "colorPalette.subtle" : undefined}
      _hover={{
        bg: "colorPalette.subtle",
        color: "colorPalette.fg",
      }}
      transition="all 0.2s"
      asChild
    >
      <Link to={to}>
        {icon}
        {!collapsed && label}
      </Link>
    </Button>
  );

  if (collapsed) {
    return (
      <Tooltip
        openDelay={500}
        content={label}
        positioning={{
          placement: "right",
          offset: { mainAxis: 12 },
        }}
      >
        {linkContent}
      </Tooltip>
    );
  }

  return linkContent;
}

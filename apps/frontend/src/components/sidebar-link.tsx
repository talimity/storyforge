import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

import { Button, Tooltip } from "@/components/ui";

interface SidebarLinkProps {
  to: string;
  icon: ReactNode;
  label: ReactNode;
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
      colorPalette="grey"
      variant="ghost"
      w="full"
      h="10"
      justifyContent={collapsed ? "center" : "start"}
      gap="3"
      verticalAlign="super"
      px={collapsed ? "2" : "4"}
      color={isActive ? "content.emphasized" : "content.subtle"}
      bg={isActive ? "surface.emphasized" : undefined}
      _hover={{
        bg: "surface.emphasized",
        color: "content.emphasized",
      }}
      transition="all 0.2s"
      asChild
      overflow="hidden"
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

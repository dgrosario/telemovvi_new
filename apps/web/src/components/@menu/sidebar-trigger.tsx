"use client";

import { Button } from "@mui/material";
import useVerticalNav from "./hooks/useVerticalNav";

export function SidebarTrigger({
  className,
  onClick,
  ...props
}: React.ComponentProps<typeof Button>) {
  const { updateVerticalNavState, isCollapsed, isHovered } = useVerticalNav();

  const showIcon = !isCollapsed || isHovered;

  return (
    <Button
      data-sidebar="trigger"
      data-slot="sidebar-trigger"
      variant="text"
      sx={{
        minWidth: "auto",
        padding: "8px",
        color: "var(--mui-palette-text-primary)",
        "&:hover": {
          backgroundColor: "rgba(0, 0, 0, 0.04)",
        },
      }}
      onClick={() => {
        updateVerticalNavState({ isCollapsed: !isCollapsed });
      }}
      {...props}
    >
      <i className={`${isCollapsed && !isHovered ? "tabler-menu" : "tabler-layout-sidebar-left-collapse"} size-5`} />
    </Button>
  );
}

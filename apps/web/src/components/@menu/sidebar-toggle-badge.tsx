"use client";
import { Button } from "@mui/material";
import useVerticalNav from "./hooks/useVerticalNav";

export function SidebarToggleBadge() {
  const { isCollapsed, updateVerticalNavState } = useVerticalNav();

  const handleClick = () => {
    updateVerticalNavState({ isCollapsed: !isCollapsed });
  };

  return (
    <Button
      onClick={handleClick}
      sx={{
        position: "absolute",
        right: "-14px",
        top: "50%",
        transform: "translateY(-50%)",
        minWidth: "unset",
        width: "32px",
        height: "32px",
        borderRadius: "50%",
        aspectRatio: "1 / 1",
        padding: 0,
        backgroundColor: "white",
        border: "none",
        boxShadow: "0 2px 10px rgba(0,0,0,0.2)",
        zIndex: 1000,
        color: "#666",
        "&:hover": {
          backgroundColor: "#f5f5f5",
          boxShadow: "0 3px 12px rgba(0,0,0,0.25)",
        },
      }}
    >
      <i
        className={isCollapsed ? "tabler-chevron-right" : "tabler-chevron-left"}
        style={{ fontSize: "16px" }}
      />
    </Button>
  );
}

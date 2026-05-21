"use client";

import { AppBar, IconButton, Toolbar, Typography } from "@mui/material";
import { Menu } from "lucide-react";
import { NavUser } from "../nav-user";
import { User } from "@omnichannel/core/domain/entities/user";

interface TopAppBarProps {
  onDrawerToggle: () => void;
  user?: User.Raw;
  workspaceSelected: {
    workspaces: { id: string; name: string }[];
    workspace: { id: string; name: string };
  };
}

export function TopAppBar({
  onDrawerToggle,
  user,
  workspaceSelected,
}: TopAppBarProps) {
  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
      }}
    >
      <Toolbar sx={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <IconButton
            color="inherit"
            edge="start"
            onClick={onDrawerToggle}
            sx={{
              display: { md: "none" },
            }}
          >
            <Menu size={24} />
          </IconButton>
          <Typography variant="h6" noWrap component="div">
            Omnichannel
          </Typography>
        </div>
        <NavUser workspaceSelected={workspaceSelected} user={user} />
      </Toolbar>
    </AppBar>
  );
}

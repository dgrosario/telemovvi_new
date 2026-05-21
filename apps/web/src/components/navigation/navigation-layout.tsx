"use client";

import { Box, Toolbar } from "@mui/material";
import { useState } from "react";
import { MainDrawer } from "./main-drawer";
import { TopAppBar } from "./top-app-bar";
import { User } from "@omnichannel/core/domain/entities/user";

interface NavigationLayoutProps {
  user: User.Raw;
  workspaceSelected: {
    workspaces: { id: string; name: string }[];
    workspace: { id: string; name: string };
  };
  children: React.ReactNode;
}

export function NavigationLayout({
  user,
  workspaceSelected,
  children,
}: NavigationLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  return (
    <Box sx={{ display: "flex" }}>
      <TopAppBar
        onDrawerToggle={handleDrawerToggle}
        user={user}
        workspaceSelected={workspaceSelected}
      />
      <MainDrawer mobileOpen={mobileOpen} onDrawerToggle={handleDrawerToggle} />
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: "100%",
          minHeight: "100vh",
          backgroundColor: "#F9FAFC",
        }}
      >
        <Toolbar />
        {children}
      </Box>
    </Box>
  );
}

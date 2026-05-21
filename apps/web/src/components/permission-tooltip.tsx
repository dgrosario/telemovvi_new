import { Tooltip } from "@mui/material";
import React from "react";

interface PermissionTooltipProps {
  hasPermission: boolean;
  message?: string;
  children: React.ReactElement;
}

export const PermissionTooltip: React.FC<PermissionTooltipProps> = ({
  hasPermission,
  message,
  children,
}) => {
  if (hasPermission) {
    return children;
  }

  return (
    <Tooltip title={message || "Permissão necessária não concedida"} arrow>
      <span>{children}</span>
    </Tooltip>
  );
};

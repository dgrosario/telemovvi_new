"use client";

import { cn } from "@/lib/utils";
import { IconButton, Menu, MenuItem } from "@mui/material";
import { MouseEvent, ReactNode, useState } from "react";
import ModalConfirmDelete from "./modal-confirm-delete";

type Option = {
  id: string;
  label: string | ReactNode;
  action?: () => void | Promise<void>;
  icon?: ReactNode;
  hidden?: boolean;
  disabled?: boolean;
  confirm?: {
    title?: string;
    description?: string;
    resourceName: string;
    variant?: "error";
  };
};

type Props = {
  options: Option[];
};

export const ActionsCell: React.FC<Props> = (props) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton
        aria-label="more"
        aria-controls="long-menu"
        aria-haspopup="true"
        onClick={handleClick}
      >
        <i className="tabler-dots-vertical" />
      </IconButton>
      <Menu
        keepMounted
        id="long-menu"
        anchorEl={anchorEl}
        onClose={handleClose}
        open={Boolean(anchorEl)}
        slotProps={{ paper: { style: { maxHeight: 48 * 4.5 } } }}
      >
        {props.options
          .filter((option) => !option.hidden)
          .map((option) => {
            if (option.confirm) {
              return (
                <ModalConfirmDelete
                  key={option.id}
                  resourceName={option.confirm.resourceName ?? ""}
                  dialogTitle={option.confirm.title}
                  dialogContent={
                    option.confirm.description
                      ? `${option.confirm.description} (${option.confirm.resourceName})`
                      : `Tem certeza que deseja remover ? (${option.confirm.resourceName})`
                  }
                  onConfirm={() => {
                    option.action?.();
                  }}
                  disabled={option.disabled}
                >
                  <MenuItem disabled={option.disabled}>
                    {option.icon}
                    <span
                      className={cn(
                        "font-light",
                        option.confirm.variant === "error" &&
                          !option.disabled &&
                          "text-red-500"
                      )}
                    >
                      {option.label}
                    </span>
                  </MenuItem>
                </ModalConfirmDelete>
              );
            }
            return (
              <MenuItem
                key={option.id}
                disabled={option.disabled}
                onClick={() => {
                  handleClose();
                  option?.action?.();
                }}
                classes={{
                  root: cn(typeof option.label !== "string" && "!p-0"),
                }}
              >
                {option.icon}
                <span className="font-light">{option.label}</span>
              </MenuItem>
            );
          })}
      </Menu>
    </>
  );
};

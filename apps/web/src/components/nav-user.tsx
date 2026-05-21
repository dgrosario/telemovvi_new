"use client";

import { KeyRound, LogOut, Check, Building2, ChevronDown, Settings } from "lucide-react";
import Collapse from "@mui/material/Collapse";

import { changeWorkspace, signOut } from "@/app/actions/users";
import { useSidebar } from "@/components/ui/sidebar";
import useVerticalNav from "@/components/@menu/hooks/useVerticalNav";
import { User } from "@omnichannel/core/domain/entities/user";
import { useState, useEffect } from "react";
import { useServerAction } from "zsa-react";
import CustomAvatar from "./custom-avatar";
import { DialogChangePassword } from "./dialog-change-password";
import { DialogPreferences } from "./dialog-preferences";
import { useServerActionMutation } from "@/hooks/server-action-hooks";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { PolicyName } from "@omnichannel/core/domain/services/permissions";

export function NavUser(props: {
  user?: User.Raw;
  workspaceSelected: {
    workspaces: { id: string; name: string }[];
    workspace: { id: string; name: string };
  };
  permissions?: PolicyName[];
}) {
  const { setLoading } = useSidebar();
  const { isCollapsed, isHovered } = useVerticalNav();
  const signOutAction = useServerAction(signOut);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(
    props.user?.signatureEnabled ?? true
  );
  const [isOpen, setIsOpen] = useState(false);

  const changeWorkspaceAction = useServerActionMutation(changeWorkspace, {
    onSuccess() {
      window.location.reload();
    },
  });

  const showFull = !isCollapsed || isHovered;

  useEffect(() => {
    setIsOpen(false);
  }, [showFull]);

  const avatarInitials = props.user?.name
    .split(" ")
    .map((w) => w[0])
    .join("");

  const hasMultipleWorkspaces = props.workspaceSelected.workspaces.length > 1;

  const menuContent = (
    <>
      {hasMultipleWorkspaces && (
        <>
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-medium text-gray-500 uppercase">
            <Building2 className="size-3" />
            Workspace
          </div>
          {props.workspaceSelected.workspaces.map((w) => {
            const isSelected = props.workspaceSelected.workspace.id === w.id;
            return (
              <button
                key={w.id}
                onClick={() => {
                  setLoading(true);
                  setIsOpen(false);
                  changeWorkspaceAction.mutate({
                    workspaceId: w.id,
                    pathname: window.location.pathname,
                  });
                }}
                className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 text-sm rounded-md cursor-pointer hover:bg-gray-100 ${
                  isSelected
                    ? "bg-primary/10 text-primary font-medium hover:bg-primary/15"
                    : "text-gray-600"
                }`}
              >
                <span className="truncate">{w.name}</span>
                {isSelected && <Check className="size-4 shrink-0" />}
              </button>
            );
          })}
          <div className="h-px bg-gray-200 my-2" />
        </>
      )}

      <button
        onClick={() => {
          setIsOpen(false);
          setPreferencesOpen(true);
        }}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 rounded-md cursor-pointer hover:bg-gray-100"
      >
        <Settings className="size-4" />
        Preferencias
      </button>
      <button
        onClick={() => {
          setIsOpen(false);
          setChangePasswordOpen(true);
        }}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-gray-700 rounded-md cursor-pointer hover:bg-gray-100"
      >
        <KeyRound className="size-4" />
        Alterar senha
      </button>
      <button
        onClick={() => signOutAction.execute()}
        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm text-red-600 rounded-md cursor-pointer hover:bg-red-50"
      >
        <LogOut className="size-4" />
        Sair
      </button>
    </>
  );

  if (showFull) {
    return (
      <>
        <DialogChangePassword
          open={changePasswordOpen}
          onOpenChange={setChangePasswordOpen}
        />
        <DialogPreferences
          open={preferencesOpen}
          onOpenChange={setPreferencesOpen}
          signatureEnabled={signatureEnabled}
          onSignatureChange={setSignatureEnabled}
        />
        <div className="w-full flex flex-col gap-2">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="w-full rounded-md items-center cursor-pointer py-2 px-2 gap-3 outline-0 ring-0 flex transition-all duration-300"
          >
            <CustomAvatar className="size-9 shrink-0">
              {avatarInitials}
            </CustomAvatar>
            <div className="grid flex-1 text-left min-w-0 overflow-hidden">
              <span className="truncate text-sm font-medium text-gray-900">
                {props.user?.name}
              </span>
              <span className="truncate text-xs text-gray-500">
                {props.user?.email}
              </span>
            </div>
            <ChevronDown
              className={`size-4 text-gray-500 transition-transform duration-200 ${
                isOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          <Collapse in={isOpen} timeout={200}>
            <div className="mt-1 max-h-48 overflow-y-auto">
              {menuContent}
            </div>
          </Collapse>
        </div>
      </>
    );
  }

  return (
    <>
      <DialogChangePassword
        open={changePasswordOpen}
        onOpenChange={setChangePasswordOpen}
      />
      <DialogPreferences
        open={preferencesOpen}
        onOpenChange={setPreferencesOpen}
        signatureEnabled={signatureEnabled}
        onSignatureChange={setSignatureEnabled}
      />
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <button className="w-full justify-center rounded-md items-center cursor-pointer py-2 px-2 gap-3 outline-0 ring-0 flex transition-all duration-300">
            <CustomAvatar className="size-9 shrink-0">
              {avatarInitials}
            </CustomAvatar>
          </button>
        </PopoverTrigger>
        <PopoverContent side="right" align="end" sideOffset={8} className="w-56 p-2">
          {menuContent}
        </PopoverContent>
      </Popover>
    </>
  );
}

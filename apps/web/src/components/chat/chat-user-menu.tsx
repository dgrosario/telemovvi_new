"use client";

import { KeyRound, LogOut, Settings } from "lucide-react";
import { signOut } from "@/app/actions/users";
import { User } from "@omnichannel/core/domain/entities/user";
import { useState } from "react";
import { useServerAction } from "zsa-react";
import CustomAvatar from "../custom-avatar";
import { DialogChangePassword } from "../dialog-change-password";
import { DialogPreferences } from "../dialog-preferences";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

type ChatUserMenuProps = {
  user?: User.Raw;
};

export function ChatUserMenu({ user }: ChatUserMenuProps) {
  const signOutAction = useServerAction(signOut);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [signatureEnabled, setSignatureEnabled] = useState(
    user?.signatureEnabled ?? true
  );
  const [isOpen, setIsOpen] = useState(false);

  const avatarInitials = user?.name
    ?.split(" ")
    .map((w) => w[0])
    .join("") || "?";

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
          <button className="rounded-full items-center cursor-pointer outline-0 ring-0 flex transition-all duration-300 hover:opacity-80">
            <CustomAvatar className="size-9 shrink-0">
              {avatarInitials}
            </CustomAvatar>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" sideOffset={8} className="w-56 p-2">
          <div className="px-2 py-1.5 text-sm font-medium text-gray-900 border-b mb-2 pb-2">
            {user?.name}
          </div>
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
        </PopoverContent>
      </Popover>
    </>
  );
}

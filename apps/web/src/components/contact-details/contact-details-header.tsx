"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import CustomAvatar from "@/components/custom-avatar";
import { IconButton } from "@mui/material";

type Props = {
  name: string;
  thumbnail?: string;
  value?: string;
  onClose: () => void;
};

function getAcronym(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    return words[0].substring(0, 2).toUpperCase();
  }
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export function ContactDetailsHeader({ name, thumbnail, value, onClose }: Props) {
  return (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur border-b px-4 py-3 flex items-center gap-3">
      <IconButton onClick={onClose} size="small" className="!text-gray-500 hover:!text-gray-700 !bg-gray-100/80">
        <i className="tabler-x size-5" />
      </IconButton>
      <span className="text-gray-900 font-semibold text-base">Dados do contato</span>
    </div>
  );
}

export function ContactDetailsProfile({ name, thumbnail, value }: Omit<Props, 'onClose'>) {
  return (
    <div className="bg-gradient-to-b from-slate-50 to-white flex flex-col items-center py-7 px-4 border-b">
      <Avatar className="size-24 bg-white border-2 shadow-sm mb-3">
        <AvatarImage src={thumbnail} className="object-cover" />
        <AvatarFallback className="border text-xl">
          <CustomAvatar skin="light-static" color="primary" className="size-20 text-xl">
            {getAcronym(name)}
          </CustomAvatar>
        </AvatarFallback>
      </Avatar>

      <h2 className="text-gray-900 text-2xl font-bold text-center">
        {name}
      </h2>
      {value && (
        <p className="text-gray-500 text-base mt-0.5">
          {value}
        </p>
      )}
    </div>
  );
}

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
    <div className="bg-gray-50 border-b px-4 py-3 flex items-center gap-3">
      <IconButton onClick={onClose} size="small" className="!text-gray-500 hover:!text-gray-700">
        <i className="tabler-x size-5" />
      </IconButton>
      <span className="text-gray-800 font-medium text-sm">Dados do contato</span>
    </div>
  );
}

export function ContactDetailsProfile({ name, thumbnail, value }: Omit<Props, 'onClose'>) {
  return (
    <div className="bg-gray-50 flex flex-col items-center py-6 px-4">
      <Avatar className="size-20 bg-white border mb-3">
        <AvatarImage src={thumbnail} className="object-cover" />
        <AvatarFallback className="border text-xl">
          <CustomAvatar skin="light-static" color="primary" className="size-20 text-xl">
            {getAcronym(name)}
          </CustomAvatar>
        </AvatarFallback>
      </Avatar>

      <h2 className="text-gray-900 text-lg font-semibold text-center">
        {name}
      </h2>
      {value && (
        <p className="text-gray-500 text-sm mt-0.5">
          {value}
        </p>
      )}
    </div>
  );
}

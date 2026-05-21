"use client";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Smile } from "lucide-react";
import { IconButton } from "@mui/material";
import dynamic from "next/dynamic";
import { useState, useCallback } from "react";

const Picker = dynamic(
  () => import("@emoji-mart/react").then((mod) => mod.default),
  {
    ssr: false,
    loading: () => (
      <div className="w-[352px] h-[435px] bg-white flex items-center justify-center">
        <span className="text-gray-400">Carregando...</span>
      </div>
    ),
  }
);

interface EmojiData {
  native: string;
  id: string;
  name: string;
  unified: string;
  shortcodes: string;
}

interface EmojiPickerButtonProps {
  onEmojiSelect: (emoji: string) => void;
  disabled?: boolean;
}

export function EmojiPickerButton({ onEmojiSelect, disabled }: EmojiPickerButtonProps) {
  const [open, setOpen] = useState(false);

  const handleEmojiSelect = useCallback(
    (emoji: EmojiData) => {
      onEmojiSelect(emoji.native);
      setOpen(false);
    },
    [onEmojiSelect]
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconButton
          size="small"
          disabled={disabled}
          className="hover:bg-gray-100"
          title="Inserir emoji"
        >
          <Smile className="size-5 text-gray-600" />
        </IconButton>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none shadow-xl"
        side="top"
        align="start"
        sideOffset={8}
      >
        <Picker
          data={async () => {
            const data = await import("@emoji-mart/data");
            return data.default;
          }}
          onEmojiSelect={handleEmojiSelect}
          locale="pt"
          theme="light"
          previewPosition="none"
          skinTonePosition="search"
          maxFrequentRows={2}
          perLine={9}
        />
      </PopoverContent>
    </Popover>
  );
}

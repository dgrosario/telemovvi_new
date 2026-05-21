"use client";

import { useState, useCallback } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { QUICK_REACTIONS } from "./message-reactions";
import dynamic from "next/dynamic";

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

interface ReactionEmojiButtonProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  isOwnMessage?: boolean;
  className?: string;
}

export function ReactionEmojiButton({
  onSelect,
  disabled,
  isOwnMessage,
  className,
}: ReactionEmojiButtonProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  const handleEmojiSelect = useCallback(
    (emoji: EmojiData) => {
      onSelect(emoji.native);
      setPickerOpen(false);
    },
    [onSelect]
  );

  const handleQuickReaction = useCallback(
    (emoji: string) => {
      onSelect(emoji);
      setPickerOpen(false);
    },
    [onSelect]
  );

  if (disabled) {
    return null;
  }

  return (
    <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded-full text-xs transition-all",
            "bg-white/80 border border-gray-200 text-gray-500 hover:bg-gray-100 hover:text-gray-700",
            "opacity-0 group-hover:opacity-100",
            pickerOpen && "opacity-100",
            className
          )}
          title="Adicionar reacao"
        >
          <span className="text-sm">😊</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-none shadow-xl"
        side="top"
        align={isOwnMessage ? "start" : "end"}
        sideOffset={8}
        avoidCollisions
      >
        <div className="bg-white rounded-lg overflow-hidden">
          <div className="flex items-center gap-1 p-2 border-b border-gray-100">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleQuickReaction(emoji)}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 transition-colors text-lg"
              >
                {emoji}
              </button>
            ))}
          </div>
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
        </div>
      </PopoverContent>
    </Popover>
  );
}

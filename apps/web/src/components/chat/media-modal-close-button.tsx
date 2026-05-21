"use client";

import { X } from "lucide-react";

interface MediaModalCloseButtonProps {
  onClick: () => void;
}

export function MediaModalCloseButton({ onClick }: MediaModalCloseButtonProps) {
  return (
    <button
      onClick={onClick}
      className="absolute top-2 right-2 z-50 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
      aria-label="Fechar"
    >
      <X className="w-6 h-6" />
    </button>
  );
}

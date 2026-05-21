"use client";

import { PenLine, StickyNote } from "lucide-react";
import { toast } from "react-toastify";

interface FloatingActionButtonsProps {
  isInternal: boolean;
  signatureEnabled: boolean;
  sendWithSignature: boolean;
  onToggleSignature: () => void;
  canSendInternalComment: boolean;
  isInternalNote: boolean;
  onToggleInternalNote: () => void;
}

export function FloatingActionButtons({
  isInternal,
  signatureEnabled,
  sendWithSignature,
  onToggleSignature,
  canSendInternalComment,
  isInternalNote,
  onToggleInternalNote,
}: FloatingActionButtonsProps) {
  if (isInternal) return null;

  const handleToggleSignature = () => {
    onToggleSignature();
    if (!sendWithSignature) {
      toast.success("Assinatura ativada", { autoClose: 1500 });
    } else {
      toast.info("Assinatura desativada", { autoClose: 1500 });
    }
  };

  const handleToggleInternalNote = () => {
    onToggleInternalNote();
    if (!isInternalNote) {
      toast.success("Nota interna ativada", { autoClose: 1500 });
    } else {
      toast.info("Nota interna desativada", { autoClose: 1500 });
    }
  };

  return (
    <div className="md:hidden fixed right-3 top-1/2 -translate-y-1/2 flex flex-col gap-3 z-[100]">
      {signatureEnabled && (
        <button
          type="button"
          onClick={handleToggleSignature}
          className={`flex items-center justify-center size-11 rounded-lg shadow-lg transition-all ${
            sendWithSignature
              ? "bg-orange-500 text-white"
              : "bg-white text-gray-600 border border-gray-200"
          }`}
          title={sendWithSignature ? "Assinatura ativada" : "Assinatura desativada"}
        >
          <PenLine className="size-4.5" />
        </button>
      )}
      {canSendInternalComment && (
        <button
          type="button"
          onClick={handleToggleInternalNote}
          className={`flex items-center justify-center size-11 rounded-lg shadow-lg transition-all ${
            isInternalNote
              ? "bg-orange-300 text-white"
              : "bg-white text-gray-600 border border-gray-200"
          }`}
          title={isInternalNote ? "Nota interna ativada" : "Adicionar nota interna"}
        >
          <StickyNote className="size-4.5" />
        </button>
      )}
    </div>
  );
}

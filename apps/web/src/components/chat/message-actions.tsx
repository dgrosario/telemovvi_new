"use client";
import React, { useState } from "react";
import { ChevronDown, Pencil, Reply, Star, Trash2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usePermissionCheck } from "@/hooks/use-permission-check";

type Props = {
  messageId: string;
  canDelete: boolean;
  canEdit?: boolean;
  canReply?: boolean;
  onDelete: () => void;
  onEdit?: () => void;
  onReply?: () => void;
  onForward?: () => void;
  isDeleting?: boolean;
  isEditing?: boolean;
  className?: string;
  isStarred?: boolean;
  onToggleStar?: () => void;
  isTogglingStarred?: boolean;
  isOwnMessage?: boolean;
};

export const MessageActions: React.FC<Props> = ({
  canDelete,
  canEdit,
  canReply,
  onDelete,
  onEdit,
  onReply,
  onForward,
  isDeleting,
  isEditing,
  className,
  isStarred,
  onToggleStar,
  isTogglingStarred,
}) => {
  const [open, setOpen] = useState(false);
  const { hasPermission: canSendMessage } = usePermissionCheck(["send:message"]);

  const showDelete = canDelete && canSendMessage;
  const showEdit = canEdit && canSendMessage;
  const showReply = canReply && canSendMessage;
  const showForward = onForward && canSendMessage;

  const handleDelete = () => {
    onDelete();
    setOpen(false);
  };

  const handleEdit = () => {
    onEdit?.();
    setOpen(false);
  };

  const handleReply = () => {
    onReply?.();
    setOpen(false);
  };

  const handleForward = () => {
    onForward?.();
    setOpen(false);
  };

  const handleToggleStar = () => {
    onToggleStar?.();
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            "opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-black/10 transition-opacity",
            open && "opacity-100",
            className
          )}
        >
          <ChevronDown className="size-4 text-gray-500" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-40 border border-gray-200/30 !bg-white/50 backdrop-blur-sm shadow-lg"
      >
        {showReply && (
          <DropdownMenuItem onClick={handleReply}>
            <Reply className="size-4 mr-2" />
            Responder
          </DropdownMenuItem>
        )}
        {showForward && (
          <DropdownMenuItem onClick={handleForward}>
            <i className="tabler-arrow-forward size-4 mr-2" />
            Encaminhar
          </DropdownMenuItem>
        )}
        {onToggleStar && (
          <DropdownMenuItem onClick={handleToggleStar} disabled={isTogglingStarred}>
            <Star
              className={cn("size-4 mr-2", isStarred && "fill-yellow-400 text-yellow-400")}
            />
            {isTogglingStarred
              ? "..."
              : isStarred
                ? "Remover favorito"
                : "Favoritar"}
          </DropdownMenuItem>
        )}
        {(showReply || showForward || onToggleStar) && (showEdit || showDelete) && <DropdownMenuSeparator />}
        {showEdit && (
          <DropdownMenuItem onClick={handleEdit} disabled={isEditing}>
            <Pencil className="size-4 mr-2" />
            {isEditing ? "Editando..." : "Editar"}
          </DropdownMenuItem>
        )}
        {showEdit && showDelete && <DropdownMenuSeparator />}
        {showDelete && (
          <DropdownMenuItem
            variant="destructive"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            <Trash2 className="size-4 mr-2" />
            {isDeleting ? "Apagando..." : "Apagar"}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

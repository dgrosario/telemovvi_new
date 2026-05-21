import { sendMessage } from "@/app/actions/messages";
import { sendInternalMessage } from "@/app/actions/internal-conversations";
import { sendInternalComment } from "@/app/actions/internal-comments";
import { listGeneralTemplates, listTemplates } from "@/app/actions/templates";
import { listQuickMessages, resolveQuickMessageVariables, resolveMessageVariables } from "@/app/actions/quick-messages";
import {
  useServerActionMutation,
  useServerActionQuery,
} from "@/hooks/server-action-hooks";
import { useChat } from "@/hooks/use-chat";
import { usePermissionCheck } from "@/hooks/use-permission-check";
import { Button } from "@/components/ui/button";
import { Attendant } from "@omnichannel/core/domain/entities/attendant";
import { Conversation } from "@omnichannel/core/domain/entities/conversation";
import { Message } from "@omnichannel/core/domain/entities/message";
import { Send, Loader2, PenLine, StickyNote } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { toast } from "react-toastify";
import { QuickMessagesSelectorPopover } from "@/components/quick-messages-selector-popover";
import { FlowSelectorPopover } from "@/components/flow-selector-popover";
import { EmojiPickerButton } from "./emoji-picker-button";

type Props = {
  conversation?: Conversation.Raw;
  inRecording: boolean;
  disabled: boolean;
  placeholder?: string;
  onHasContentChange?: (hasContent: boolean) => void;
  onPasteFile?: (file: File, caption?: string) => void;
  onOpenAttachMenu?: (event: React.MouseEvent<HTMLElement>) => void;
  onSignatureChange?: (enabled: boolean) => void;
  isInternalNote?: boolean;
  onInternalNoteChange?: (enabled: boolean) => void;
};

export type SlashTextareaRef = {
  setText: (text: string) => void;
  focus: () => void;
  submit: () => void;
  hasContent: boolean;
  isSending: boolean;
  sendWithSignature: boolean;
  setSendWithSignature: (value: boolean) => void;
};

type Command = {
  id: string;
  name: string;
  text: string;
  label?: string;
  channel?: string;
  type?: "whatsapp" | "general" | "fixed" | "quick";
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaName?: string | null;
};

const SlashTextarea = forwardRef<SlashTextareaRef, Props>((props, ref) => {
  const { inRecording, conversation, disabled, placeholder, onHasContentChange, onPasteFile, onOpenAttachMenu, isInternalNote = false, onInternalNoteChange } = props;
  const formRef = useRef<HTMLFormElement>(null);
  const sendMessageAction = useServerActionMutation(sendMessage, {
    onError(error) {
      toast.error(error.message);
    },
  });
  const sendInternalMessageAction = useServerActionMutation(sendInternalMessage, {
    onError(error) {
      toast.error(error.message);
    },
  });
  const sendInternalCommentAction = useServerActionMutation(sendInternalComment, {
    onError(error) {
      toast.error(error.message);
    },
  });
  const store = useChat();
  const { hasPermission: canSendInternalComment } = usePermissionCheck(["send:internal-comment"]);
  const { hasPermission: canBypassAttendance } = usePermissionCheck([
    "bypass:attendance-to-send",
  ]);
  const { hasPermission: canManageTemplates } = usePermissionCheck(["manage:templates"]);
  const { hasPermission: canCreateQuickMessages } = usePermissionCheck(["create:quick-messages"]);

  const isInternal = useMemo(() => {
    return conversation?.conversationType === "direct" || conversation?.conversationType === "group";
  }, [conversation?.conversationType]);

  const isWhatsAppGroup = useMemo(() => {
    return conversation?.conversationType === "whatsapp-group";
  }, [conversation?.conversationType]);
  const [value, setValue] = useState("");
  const [showCommands, setShowCommands] = useState(false);
  const [filtered, setFiltered] = useState<Command[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTemplate, setSelectedTemplate] = useState<{
    id: string;
    name: string;
    variables: { name: string; value: string }[];
  } | null>(null);
  const [sendWithSignature, setSendWithSignature] = useState(() => {
    return store?.user?.signatureEnabled ?? false;
  });

  const { data: templates = [] } = useServerActionQuery(listTemplates, {
    input: undefined,
    queryKey: ["list-templates"],
    enabled: canManageTemplates,
  });

  const { data: generalTemplates = [] } = useServerActionQuery(
    listGeneralTemplates,
    {
      input: undefined,
      queryKey: ["list-general-templates"],
      enabled: canManageTemplates,
    }
  );

  const { data: quickMessages = [] } = useServerActionQuery(listQuickMessages, {
    input: undefined,
    queryKey: ["list-quick-messages"],
    enabled: canCreateQuickMessages,
  });

  const resolveVariablesAction = useServerActionMutation(
    resolveQuickMessageVariables,
    {
      onError(error) {
        toast.error("Erro ao resolver variáveis: " + error.message);
      },
    }
  );

  const resolveMessageVariablesAction = useServerActionMutation(
    resolveMessageVariables,
    {
      onError(error) {
        toast.error("Erro ao resolver variáveis: " + error.message);
      },
    }
  );

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const resetForm = useCallback(() => {
    formRef.current?.reset();
    setValue("");
    setSelectedTemplate(null);
    setShowCommands(false);
    store.clearReply();
    if (textareaRef.current) {
      textareaRef.current.value = "";
      textareaRef.current.style.height = "auto";
    }
  }, [store]);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    // Mobile: max 100px (~4-5 linhas), Desktop: max 150px (~7 linhas)
    const maxHeight = window.innerWidth < 768 ? 100 : 150;
    const newHeight = Math.max(22, Math.min(textarea.scrollHeight, maxHeight));
    textarea.style.height = `${newHeight}px`;
  }, [value]);

  useEffect(() => {
    if (store.replyingTo) {
      const timeoutId = setTimeout(() => {
        textareaRef.current?.focus();
      }, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [store.replyingTo]);

  const fixedCommands: Command[] = [
    {
      id: "clear",
      name: "/clear",
      text: "",
      label: "Limpar Texto",
      type: "fixed",
    },
  ];

  const templateCommands: Command[] = templates.map((t) => ({
    id: t.id,
    name: "/" + t.name,
    label: "",
    text: t.text,
    channel: t.channel.name,
    type: "whatsapp",
  }));

  const generalTemplateCommands: Command[] = generalTemplates.map((t) => ({
    id: t.id,
    name: "/" + t.name,
    text: t.text,
    channel: t.channel.name,
    type: "general",
  }));

  const quickMessageCommands: Command[] = quickMessages.map((qm) => ({
    id: qm.id,
    name: "/" + qm.shortcode,
    text: qm.message,
    label: qm.message.substring(0, 50) + (qm.message.length > 50 ? "..." : ""),
    type: "quick",
    mediaUrl: qm.mediaUrl,
    mediaType: qm.mediaType,
    mediaName: qm.mediaName,
  }));

  const allCommands = [
    ...fixedCommands,
    ...quickMessageCommands,
    ...templateCommands,
    ...generalTemplateCommands,
  ];
  const slashCommands = allCommands.filter(
    (cmd) => cmd.type === "quick" || cmd.type === "fixed"
  );

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const text = e.target.value;

    setValue(text);

    if (text.endsWith("/")) {
      setFiltered(slashCommands);
      setSelectedIndex(0);
      setShowCommands(slashCommands.length > 0);
      return;
    }

    const slashIndex = text.lastIndexOf("/");

    if (slashIndex >= 0) {
      const search = text.slice(slashIndex + 1).toLowerCase().trim();

      const newList = slashCommands.filter((cmd) => {
        const commandName = cmd.name.replace(/^\//, "").toLowerCase();

        if (cmd.type === "quick") {
          return (
            commandName.includes(search) ||
            cmd.text.toLowerCase().includes(search)
          );
        }

        return commandName.includes(search);
      });

      setFiltered(newList);
      setSelectedIndex(0);
      setShowCommands(newList.length > 0);
    } else {
      setShowCommands(false);
    }
  }

  async function selectCommand(cmd: Command) {
    if (cmd.type === "quick") {
      try {
        const resolved = await resolveVariablesAction.mutateAsync({
          quickMessageId: cmd.id,
          conversationId: conversation?.id,
        });

        if (resolved.mediaUrl && resolved.mediaType && resolved.mediaName) {
          const response = await fetch(resolved.mediaUrl);
          const blob = await response.blob();
          const file = new File([blob], resolved.mediaName, { type: blob.type });

          onPasteFile?.(file, resolved.message || undefined);
          setShowCommands(false);
          return;
        }

        setValue(resolved.message);
        setShowCommands(false);
        textareaRef.current?.focus();

        return;
      } catch (error) {
        console.error("[SlashTextArea] Erro ao resolver variáveis da mensagem rápida:", error);
        setValue(cmd.text);
        setShowCommands(false);
        return;
      }
    }

    let text = cmd.text;

    const variables =
      text
        .match(/{{\s*([^}]+)\s*}}/g)
        ?.map((v) => v.replace(/{{\s*|\s*}}/g, "")) ?? [];

    variables.forEach((variable) => {
      if (variable.toLowerCase() === "nome_contato") {
        text = text.replace(
          "{{nome_contato}}",
          conversation?.contact?.name ?? ""
        );
      }
    });

    const parsedVariables = variables.map((variable) => {
      let value = "";

      switch (variable.toLowerCase()) {
        case "nome_contato":
          value = conversation?.contact?.name ?? "";
          break;
      }

      return {
        name: variable,
        value,
      };
    });

    if (cmd.type === "whatsapp") {
      setSelectedTemplate({
        id: cmd.id,
        name: cmd.name.replace("/", ""),
        variables: parsedVariables,
      });

      setValue(text);

      setShowCommands(false);
      return;
    }

    setSelectedTemplate(null);
    setValue(text);

    textareaRef.current?.removeAttribute("disabled");

    setShowCommands(false);
    textareaRef.current?.focus();
  }

  function clearWhatsappTemplate() {
    setSelectedTemplate(null);
    setValue("");

    textareaRef.current?.removeAttribute("disabled");

    textareaRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (isWhatsappTemplateSelected) {
      if (e.key === "Backspace") {
        e.preventDefault();
        clearWhatsappTemplate();
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        formRef?.current?.requestSubmit();
      }

      if (!e.ctrlKey && !e.metaKey && e.key !== "Tab") {
        e.preventDefault();
        return;
      }
    }

    // Shift+Enter sempre quebra linha
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();

      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;

      const newValue = value.slice(0, start) + "\n" + value.slice(end);
      setValue(newValue);

      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 1;
      });

      return;
    }

    if (showCommands && filtered.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < filtered.length - 1 ? prev + 1 : 0));
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filtered.length - 1));
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd) selectCommand(cmd);
        return;
      }

      if (e.key === "Escape") {
        e.preventDefault();
        setShowCommands(false);
        return;
      }

      return;
    }

    // No mobile, Enter quebra linha normalmente
    // No desktop, Enter envia (exceto se Shift+Enter)
    if (e.key === "Enter") {
      // Detectar se é mobile através do tamanho da tela
      const isMobile = window.innerWidth < 768; // md breakpoint do Tailwind
      
      if (isMobile) {
        // No mobile, Enter quebra linha normalmente (comportamento padrão do textarea)
        // Não previne o default, deixa o textarea fazer o comportamento natural
        return;
      } else {
        // No desktop, Enter envia a mensagem
        e.preventDefault();
        formRef?.current?.requestSubmit();
      }
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/") || item.type.startsWith("application/")) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const caption = value.trim() || undefined;
          onPasteFile?.(file, caption);
          setValue("");
        }
        return;
      }
    }
  }

  const handleSelectQuickMessage = useCallback(async (message: string, quickMessageId?: string) => {
    if (quickMessageId) {
      try {
        const resolved = await resolveVariablesAction.mutateAsync({
          quickMessageId,
          conversationId: conversation?.id,
        });

        if (resolved.mediaUrl && resolved.mediaType && resolved.mediaName) {
          const response = await fetch(resolved.mediaUrl);
          const blob = await response.blob();
          const file = new File([blob], resolved.mediaName, { type: blob.type });

          onPasteFile?.(file, resolved.message || undefined);
          return;
        }

        setValue(resolved.message);
        textareaRef.current?.focus();
        return;
      } catch (error) {
        console.error("[SlashTextArea] Erro ao resolver variáveis da mensagem rápida:", error);
        setValue(message);
        textareaRef.current?.focus();
        return;
      }
    }

    setValue(message);
    textareaRef.current?.focus();
  }, [conversation?.id, resolveVariablesAction, onPasteFile]);

  const handleEmojiSelect = useCallback((emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setValue((prev) => prev + emoji);
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newValue = value.slice(0, start) + emoji + value.slice(end);
    setValue(newValue);

    requestAnimationFrame(() => {
      const newPosition = start + emoji.length;
      textarea.selectionStart = textarea.selectionEnd = newPosition;
      textarea.focus();
    });
  }, [value]);

  const isWhatsappTemplateSelected = !!selectedTemplate;
  const hasContent = value.trim().length > 0 && !showCommands;

  useEffect(() => {
    onHasContentChange?.(hasContent);
  }, [hasContent, onHasContentChange]);

  const isSending = sendMessageAction.isPending || sendInternalMessageAction.isPending || sendInternalCommentAction.isPending;

  useImperativeHandle(ref, () => ({
    setText: (text: string) => {
      setValue(text);
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    },
    focus: () => {
      textareaRef.current?.focus();
    },
    submit: () => {
      formRef.current?.requestSubmit();
    },
    hasContent,
    isSending,
    sendWithSignature,
    setSendWithSignature,
  }), [hasContent, isSending, sendWithSignature]);

  return (
    <>
      <form
        ref={formRef}
        onSubmit={async (e) => {
          e.preventDefault();

          if (!conversation?.id) return;
          if (!isInternal && !conversation?.channel?.id) return;

          const form = new FormData(e.currentTarget);
          let text = form.get("message")?.toString() ?? "";

          if (!text) return;

          if (text.includes("{{") && !isInternal) {
            try {
              text = await resolveMessageVariablesAction.mutateAsync({
                content: text,
                conversationId: conversation.id,
              });
            } catch (error) {
              console.error("[SlashTextArea] Erro ao resolver variáveis:", error);
              toast.warning("Algumas variáveis não puderam ser resolvidas");
            }
          }

          const shouldSign = !isInternal && sendWithSignature && store?.user?.signatureEnabled;
          const signatureName = (store?.user?.displayName || store?.user?.name || "").trim();
          const trimmedText = text.trim();
          const content = shouldSign
            ? `*${signatureName}:*\n${trimmedText}`
            : text;

          const correlationId = crypto.randomUUID().toString();
          const message = Message.create({
            content: isInternalNote ? text : content,
            createdAt: new Date(),
            id: correlationId,
            sender: Attendant.create({
              id: store.user?.id ?? "",
              name: store.user?.name ?? "",
            }),
            type: isInternalNote ? "text" : (selectedTemplate ? "template" : "text"),
            internal: isInternalNote,
            quotedMessageId: store.replyingTo?.id,
            templateName: isInternalNote ? null : (selectedTemplate?.name ?? null),
          });

          store?.setLastSentMessageId?.(message.id);
          store?.addMessage?.(message);
          resetForm();

          try {
            if (isInternalNote) {
              const result = await sendInternalCommentAction.mutateAsync({
                content: text,
                conversationId: conversation.id,
              });

              if (result?.messageId) {
                store?.replaceMessage?.(correlationId, {
                  id: result.messageId,
                  content: text,
                  type: "text",
                  status: "sent",
                  sender: {
                    type: "attendant",
                    id: store.user?.id ?? "",
                    name: result.senderName ?? store.user?.name ?? "",
                  },
                  createdAt: new Date(),
                  internal: true,
                  caption: null,
                  filename: null,
                  mimetype: null,
                  mediaKey: null,
                  viewedAt: null,
                  deletedAt: null,
                  editedAt: null,
                  originalContent: null,
                  quotedMessageId: null,
                  templateName: null,
                  remoteJid: null,
                });
              }
            } else if (isInternal) {
              const result = await sendInternalMessageAction.mutateAsync({
                content,
                conversationId: conversation.id,
                type: "text",
              });

              if (result?.messageId) {
                store?.replaceMessage?.(correlationId, {
                  id: result.messageId,
                  content,
                  type: "text",
                  status: "sent",
                  sender: {
                    type: "attendant",
                    id: store.user?.id ?? "",
                    name: store.user?.name ?? "",
                  },
                  createdAt: new Date(),
                  internal: true,
                  caption: null,
                  filename: null,
                  mimetype: null,
                  mediaKey: null,
                  viewedAt: null,
                  deletedAt: null,
                  editedAt: null,
                  originalContent: null,
                  quotedMessageId: null,
                  templateName: null,
                  remoteJid: null,
                });
              }
            } else {
              const templateData = selectedTemplate
                ? { name: selectedTemplate.name, variables: selectedTemplate.variables }
                : null;

              const isCurrentUserAttendant =
                conversation.attendant?.id === store.user?.id;
              const shouldBypass =
                canBypassAttendance && !isCurrentUserAttendant;

              await sendMessageAction.mutateAsync({
                content,
                conversationId: conversation.id,
                channelId: conversation.channel?.id ?? "",
                templateName: templateData?.name,
                variables: templateData?.variables,
                correlationId,
                quotedMessageId: store.replyingTo?.id,
                bypassAttendance: shouldBypass,
              });
            }
          } catch (error) {
            console.error("[SlashTextArea] Erro ao enviar mensagem:", error);
            store?.markMessageAsError?.(message.id);
          }
        }}
        data-disabled={disabled}
        data-hidden={inRecording}
        className="flex w-full items-center gap-2"
      >
        {/* Desktop: Mostrar botões de assinatura e nota interna inline */}
        {!isInternal && store?.user?.signatureEnabled && (
          <button
            type="button"
            onClick={() => setSendWithSignature(!sendWithSignature)}
            className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors shrink-0 ${
              sendWithSignature
                ? "bg-orange-500 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
            title={sendWithSignature ? "Assinatura ativada" : "Assinatura desativada"}
          >
            <PenLine className="size-3.5" />
            <span className="hidden sm:inline">Assinar</span>
          </button>
        )}
        {!isInternal && canSendInternalComment && (
          <button
            type="button"
            onClick={() => onInternalNoteChange?.(!isInternalNote)}
            className={`hidden md:flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors shrink-0 ${
              isInternalNote
                ? "bg-orange-300 text-white"
                : "bg-gray-100 text-gray-500"
            }`}
            title={isInternalNote ? "Nota interna ativada" : "Adicionar nota interna"}
          >
            <StickyNote className="size-3.5" />
            <span className="hidden sm:inline">Nota interna</span>
          </button>
        )}
        <div className="relative flex-1">
          <div className="flex items-end gap-2 rounded-xl bg-slate-50 px-2 py-1.5">
            <div className="shrink-0">
              <EmojiPickerButton
                onEmojiSelect={handleEmojiSelect}
                disabled={disabled || isSending}
              />
            </div>
            <textarea
              ref={textareaRef}
              value={value}
              rows={1}
              data-hidden={inRecording}
              className={`chat-textarea resize-none outline-none flex-1 bg-transparent text-sm leading-5 max-h-[140px] overflow-y-auto ${
                isWhatsappTemplateSelected ? "opacity-80 cursor-not-allowed" : ""
              }`}
              placeholder={placeholder ?? (isInternal ? "Digite sua mensagem interna" : isWhatsAppGroup ? "Digite sua mensagem para o grupo" : "Digite sua mensagem")}
              name="message"
              onChange={isInternal ? (e) => setValue(e.target.value) : handleChange}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              disabled={!isInternal && isWhatsappTemplateSelected}
            />
            
            
            {/* Desktop: Mostrar quick messages e flows inline */}
            {!isInternal && !hasContent && (
              <div className="hidden md:flex items-center gap-1">
                <QuickMessagesSelectorPopover
                  onSelect={handleSelectQuickMessage}
                  conversationId={conversation?.id}
                />
                <FlowSelectorPopover
                  conversationId={conversation?.id}
                  disabled={disabled || isSending}
                />
              </div>
            )}
          </div>

          {!isInternal && showCommands && (
            <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-lg shadow-lg z-50 overflow-auto max-h-60">
              {filtered.map((item, index) => (
                <div
                  key={item.id}
                  onClick={() => selectCommand(item)}
                  className={`px-3 py-2 cursor-pointer hover:bg-gray-100 hover:text-primary
          ${selectedIndex === index ? "bg-gray-200 text-primary" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{item.name}</strong>

                    <div className="flex items-center gap-1">
                      {item.type === "whatsapp" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 border border-green-300">
                          WhatsApp
                        </span>
                      )}
                      {item.type === "quick" && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-300">
                          Rápida
                        </span>
                      )}
                      {item.mediaUrl && (
                        <span className="text-xs">📎</span>
                      )}
                    </div>
                  </div>

                  <div className="text-xs text-gray-500 truncate">
                    {item.label || item.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isInternal && selectedTemplate && (
            <button
              type="button"
              onClick={clearWhatsappTemplate}
              className="absolute right-2 bottom-2 flex items-center gap-1 text-sm text-red-600"
            >
              <i className="tabler-x text-lg" />
              Cancelar
            </button>
          )}
        </div>
      </form>
    </>
  );
});

SlashTextarea.displayName = "SlashTextarea";

export default SlashTextarea;

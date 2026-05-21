"use client";
import {
  checkPendingInstanceStatus,
  retrieveChannelQRCode,
} from "@/app/actions/channels";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { useQRCodeConnection } from "@/hooks/use-qrcode-connection";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useCallback } from "react";

export const ModalQRCodeConnect: React.FC = () => {
  const { channelId, pendingInstanceName, initialQrCode, onClear, onSuccess } =
    useQRCodeConnection();
  const queryClient = useQueryClient();
  const hadQrCodeRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  const isPendingReconnect = !!pendingInstanceName;

  const retrieveChannelQRCodeAction = useServerActionQuery(
    retrieveChannelQRCode,
    {
      input: { id: channelId! },
      enabled: !!channelId && !isPendingReconnect,
      queryKey: ["retrieve-qrcode-channel", channelId],
      staleTime: 0,
      gcTime: 0,
    }
  );

  const pendingStatusAction = useServerActionQuery(
    checkPendingInstanceStatus,
    {
      input: {
        channelId: channelId!,
        instanceName: pendingInstanceName!,
      },
      enabled: !!channelId && isPendingReconnect,
      queryKey: ["check-pending-status", channelId, pendingInstanceName],
      staleTime: 0,
      gcTime: 0,
    }
  );

  const checkAndClose = useCallback(() => {
    if (!channelId) return false;

    if (isPendingReconnect) {
      if (pendingStatusAction.data?.status === "connected") {
        onSuccess();
        queryClient.invalidateQueries({ queryKey: ["list-channels"] });
        return true;
      }
      return false;
    }

    const data = retrieveChannelQRCodeAction.data;
    if (!data) return false;

    const { qrcode, status } = data;

    if (qrcode && qrcode.length > 0) {
      hadQrCodeRef.current = true;
    }

    if (status === "connected") {
      onSuccess();
      queryClient.invalidateQueries({ queryKey: ["list-channels"] });
      return true;
    }

    if (hadQrCodeRef.current && !qrcode) {
      onSuccess();
      queryClient.invalidateQueries({ queryKey: ["list-channels"] });
      return true;
    }

    return false;
  }, [
    retrieveChannelQRCodeAction.data,
    pendingStatusAction.data,
    channelId,
    isPendingReconnect,
    onSuccess,
    queryClient,
  ]);

  useEffect(() => {
    if (!channelId) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    hadQrCodeRef.current = false;

    if (isPendingReconnect) {
      pendingStatusAction.refetch();
      pollingRef.current = setInterval(async () => {
        await pendingStatusAction.refetch();
      }, 2000);
    } else {
      retrieveChannelQRCodeAction.refetch();
      pollingRef.current = setInterval(async () => {
        await retrieveChannelQRCodeAction.refetch();
      }, 2000);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [channelId, isPendingReconnect]);

  useEffect(() => {
    if (checkAndClose()) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    }
  }, [
    retrieveChannelQRCodeAction.data,
    pendingStatusAction.data,
    checkAndClose,
  ]);

  const qrcode = isPendingReconnect
    ? initialQrCode
    : retrieveChannelQRCodeAction.data?.qrcode;
  const isLoading = isPendingReconnect
    ? channelId && !initialQrCode
    : retrieveChannelQRCodeAction.isLoading || (channelId && !qrcode);

  return (
    <Dialog
      open={!!channelId}
      maxWidth="xs"
      fullWidth
      aria-labelledby="max-width-dialog-title"
      closeAfterTransition={false}
      disableEnforceFocus
      disableAutoFocus
    >
      <DialogTitle id="max-width-dialog-title">
        Conecte agora ao whatsapp
      </DialogTitle>
      <DialogContent>
        <DialogContentText className="flex items-center justify-center min-h-[200px]">
          {isLoading && <CircularProgress />}
          {qrcode && <img src={qrcode} alt="QR Code WhatsApp" />}
        </DialogContentText>
      </DialogContent>
      <DialogActions className="dialog-actions-dense">
        <Button onClick={onClear}>Cancelar</Button>
      </DialogActions>
    </Dialog>
  );
};

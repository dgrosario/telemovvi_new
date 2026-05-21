"use client";
import {
  checkPendingInstanceStatus,
  retrieveChannelQRCode,
} from "@/app/actions/channels";
import { useServerActionQuery } from "@/hooks/server-action-hooks";
import { useQRCodeConnection } from "@/hooks/use-qrcode-connection";
import { Button, CircularProgress, Dialog, DialogContent, DialogTitle } from "@mui/material";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw, X } from "lucide-react";
import { useEffect, useRef, useCallback } from "react";

export const ModalQRCodeConnect: React.FC = () => {
  const { channelId, pendingInstanceName, initialQrCode, onClear, onSuccess } =
    useQRCodeConnection();
  const queryClient = useQueryClient();
  const hadQrCodeRef = useRef(false);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPendingReconnect = !!pendingInstanceName;

  const retrieveChannelQRCodeAction = useServerActionQuery(retrieveChannelQRCode, {
    input: { id: channelId! }, enabled: !!channelId && !isPendingReconnect,
    queryKey: ["retrieve-qrcode-channel", channelId], staleTime: 0, gcTime: 0,
  });

  const pendingStatusAction = useServerActionQuery(checkPendingInstanceStatus, {
    input: { channelId: channelId!, instanceName: pendingInstanceName! },
    enabled: !!channelId && isPendingReconnect,
    queryKey: ["check-pending-status", channelId, pendingInstanceName], staleTime: 0, gcTime: 0,
  });

  const checkAndClose = useCallback(() => {
    if (!channelId) return false;
    if (isPendingReconnect) {
      if (pendingStatusAction.data?.status === "connected") { onSuccess(); queryClient.invalidateQueries({ queryKey: ["list-channels"] }); return true; }
      return false;
    }
    const data = retrieveChannelQRCodeAction.data; if (!data) return false;
    const { qrcode, status } = data;
    if (qrcode && qrcode.length > 0) hadQrCodeRef.current = true;
    if (status === "connected" || (hadQrCodeRef.current && !qrcode)) { onSuccess(); queryClient.invalidateQueries({ queryKey: ["list-channels"] }); return true; }
    return false;
  }, [retrieveChannelQRCodeAction.data, pendingStatusAction.data, channelId, isPendingReconnect, onSuccess, queryClient]);

  useEffect(() => {
    if (!channelId) { if (pollingRef.current) clearInterval(pollingRef.current); pollingRef.current = null; return; }
    hadQrCodeRef.current = false;
    if (isPendingReconnect) { pendingStatusAction.refetch(); pollingRef.current = setInterval(async () => { await pendingStatusAction.refetch(); }, 2000); }
    else { retrieveChannelQRCodeAction.refetch(); pollingRef.current = setInterval(async () => { await retrieveChannelQRCodeAction.refetch(); }, 2000); }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); pollingRef.current = null; };
  }, [channelId, isPendingReconnect]);

  useEffect(() => { if (checkAndClose() && pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; } }, [retrieveChannelQRCodeAction.data, pendingStatusAction.data, checkAndClose]);

  const qrcode = isPendingReconnect ? initialQrCode : retrieveChannelQRCodeAction.data?.qrcode;
  const isLoading = isPendingReconnect ? channelId && !initialQrCode : retrieveChannelQRCodeAction.isLoading || (channelId && !qrcode);

  return (
    <Dialog open={!!channelId} maxWidth="lg" fullWidth closeAfterTransition={false}>
      <DialogTitle className="!p-0">
        <div className="flex items-center justify-between rounded-t-xl bg-[#10a37f] px-6 py-4 text-white">
          <div className="text-2xl font-semibold">WhatsApp</div>
          <Button onClick={onClear} className="!min-w-0 !rounded-full !p-2 !text-white"><X /></Button>
        </div>
      </DialogTitle>
      <DialogContent className="!px-8 !py-6">
        <h3 className="text-3xl font-medium text-gray-800">Etapas para acessar</h3>
        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-2">
          <ol className="space-y-4 text-2xl text-gray-800">
            <li><b>1.</b> Abra o <b>WhatsApp</b> no seu celular.</li>
            <li><b>2.</b> Toque em <b>Mais opções</b> no Android, ou em <b>Configurações</b> no iPhone.</li>
            <li><b>3.</b> Toque em <b>Dispositivos conectados</b> e, em seguida, em <b>Conectar dispositivo</b>.</li>
            <li><b>4.</b> Escaneie o <b>QR code</b> para confirmar.</li>
          </ol>
          <div className="flex flex-col items-center">
            <div className="rounded-2xl border bg-gray-50 p-4">
              {isLoading && <div className="flex h-[360px] w-[360px] items-center justify-center"><CircularProgress /></div>}
              {qrcode && <img src={qrcode} alt="QR Code WhatsApp" className="h-[360px] w-[360px]" />}
            </div>
            <button className="mt-4 inline-flex items-center gap-2 text-lg text-gray-500" onClick={() => retrieveChannelQRCodeAction.refetch()}><RefreshCw className="size-4" /> Novo QR</button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

import { listChannels } from "@/app/actions/channels";
import { RouteGuard } from "@/components/route-guard";
import ModalRegisterChannels from "@/components/modal-register-channels";
import { DialogLinkSectors } from "./dialog-link-sectors";
import { HeaderChannels } from "./header-channels";
import { ChannelsGrid } from "./channels-grid";
import { ModalReceivedChannel } from "./modal-received-channel";
import { ModalMetaApiCredentials } from "./modal-meta-api-credentials";
import { InstagramCallbackHandler } from "@/components/instagram-callback-handler";

export default async function ChannelsPage() {
  const [data] = await listChannels({});
  const channels = data ?? [];
  return (
    <RouteGuard permissions={["manage:connections", "list:connections"]}>
      <HeaderChannels />
      <ChannelsGrid channels={channels} />
      <ModalRegisterChannels />
      <DialogLinkSectors />
      <ModalReceivedChannel />
      <ModalMetaApiCredentials />
      <InstagramCallbackHandler />
    </RouteGuard>
  );
}

import { Channel } from "@omnichannel/core/domain/entities/channel";
import { create } from "zustand";

type Store = {
  open: boolean;
  openModalReceived: boolean;
  openLink: boolean;
  openModalMetaApiCredentials: boolean;
  channelId: string;
  channelDescription: string;
  channelType: Channel.Type | null;
  channelData: Channel.Raw | null;
  hasResponseChannel: boolean;

  toggleOpenLink(): void;

  openRegisterModal(channelId?: string, channelDescription?: string): void;
  openEditModal(channel: Channel.Raw): void;
  closeRegisterModal(): void;

  openReceivedModal(
    channelId: string,
    channelDescription: string,
    hasResponseChannel: boolean
  ): void;
  closeReceivedModal(): void;

  openMetaApiModal(channelId: string, channelDescription: string): void;
  closeMetaApiModal(): void;

  setChannelValues(
    channelId: string,
    channelDescription: string,
    hasResponseChannel?: boolean
  ): void;

  setChannelData(data: Channel.Raw | null): void;
};

export const useChannels = create<Store>((set, get) => ({
  open: false,
  openModalReceived: false,
  openLink: false,
  openModalMetaApiCredentials: false,
  channelId: "",
  channelDescription: "",
  channelType: null,
  channelData: null,
  hasResponseChannel: false,

  setChannelValues(
    channelId: string,
    channelDescription: string,
    hasResponseChannel?: boolean
  ) {
    set({
      channelId,
      channelDescription,
      hasResponseChannel: hasResponseChannel ?? false,
    });
  },

  setChannelData(data: Channel.Raw | null) {
    set({ channelData: data });
  },

  toggleOpenLink() {
    set({ openLink: !get().openLink });
  },

  openRegisterModal(channelId?: string, channelDescription?: string) {
    set({
      channelId: channelId ?? "",
      channelDescription: channelDescription ?? "",
      channelType: null,
      channelData: null,
      open: true,
    });
  },
  openEditModal(channel: Channel.Raw) {
    set({
      channelId: channel.id,
      channelDescription: channel.name,
      channelType: channel.type,
      channelData: channel,
      open: true,
    });
  },
  closeRegisterModal() {
    set({
      channelId: "",
      channelDescription: "",
      channelType: null,
      channelData: null,
      open: false,
    });
  },

  openReceivedModal(
    channelId: string,
    channelDescription: string,
    hasResponseChannel: boolean
  ) {
    set({
      channelId,
      channelDescription,
      hasResponseChannel,
      openModalReceived: true,
    });
  },
  closeReceivedModal() {
    set({
      channelId: "",
      channelDescription: "",
      hasResponseChannel: false,
      openModalReceived: false,
    });
  },

  openMetaApiModal(channelId: string, channelDescription: string) {
    set({
      channelId,
      channelDescription,
      openModalMetaApiCredentials: true,
    });
  },
  closeMetaApiModal() {
    set({
      channelId: "",
      channelDescription: "",
      openModalMetaApiCredentials: false,
    });
  },
}));

import type { MetaAppSetting, MetaChannelType, MetaSaveSettingsPayload } from "./types";

const GATEWAY_URL = process.env.NEXT_PUBLIC_GATEWAY_URL || process.env.OMNI_GATEWAY_URL || "http://localhost:3001";

export const gatewayHttpClient = {
  async getAllMetaSettings(): Promise<{ success: boolean; data?: MetaAppSetting[]; error?: string }> {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/meta-settings`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error("[gatewayHttpClient] getAllMetaSettings error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async getMetaSettings(channelType: MetaChannelType, includeSecret: boolean = false): Promise<{ success: boolean; data?: MetaAppSetting | null; error?: string }> {
    try {
      const url = `${GATEWAY_URL}/api/meta-settings/${channelType}${includeSecret ? '?includeSecret=true' : ''}`;
      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error("[gatewayHttpClient] getMetaSettings error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async saveMetaSettings(payload: MetaSaveSettingsPayload): Promise<{ success: boolean; data?: MetaAppSetting; error?: string }> {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/meta-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error("[gatewayHttpClient] saveMetaSettings error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },

  async setMetaActive(channelType: MetaChannelType, isActive: boolean): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${GATEWAY_URL}/api/meta-settings/${channelType}/active`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });

      if (!response.ok) {
        return { success: false, error: `HTTP ${response.status}` };
      }

      return await response.json();
    } catch (error) {
      console.error("[gatewayHttpClient] setMetaActive error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
};

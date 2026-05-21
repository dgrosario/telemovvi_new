import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Action, ConnectHandler } from ".";
import { loadFacebookSDK } from "../facebook-sdk";
import { MetaEmbeddedLoginConfig } from "../gateway-client";

const facebookLogin = (options: FacebookSDK.LoginOptions) =>
  new Promise<FacebookSDK.LoginResponse>((resolve) =>
    FB.login((response) => resolve(response), options)
  );

async function fetchMetaConfig(): Promise<MetaEmbeddedLoginConfig | null> {
  try {
    const response = await fetch("/api/meta/embedded-config?channelType=whatsapp");
    if (!response.ok) {
      console.error("[WhatsApp] Failed to fetch Meta config:", response.statusText);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error("[WhatsApp] Error fetching Meta config:", error);
    return null;
  }
}

export class WhatsAppConnectHandler implements ConnectHandler {
  name = "whatsapp";

  private resolveJson(input: string) {
    try {
      return JSON.parse(input);
    } catch {
      return {};
    }
  }

  async connect(channel: Channel.Raw, action: Action): Promise<void> {
    const config = await fetchMetaConfig();

    if (!config) {
      throw new Error("Configurações do WhatsApp não encontradas. Configure em Sistema > Configurações Meta.");
    }

    await loadFacebookSDK(config.appId);

    let wabaId = "";
    const controller = new AbortController();

    const handleMessage = (event: MessageEvent) => {
      if (
        event.origin !== "https://www.facebook.com" &&
        event.origin !== "https://web.facebook.com"
      ) {
        return;
      }
      const data = this.resolveJson(event.data);
      if (data.type === "WA_EMBEDDED_SIGNUP") {
        if (data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
          const { waba_id } = data.data ?? {};
          if (waba_id) wabaId = waba_id;
        }
        if (data.event === "FINISH") {
          const { waba_id } = data.data ?? {};
          if (waba_id) wabaId = waba_id;
        }
      } else {
        const code = new URLSearchParams(event.data).get("code");
        if (code) {
          controller.abort();
          action({
            id: channel.id,
            type: channel.type,
            inputPayload: {
              code,
              wabaId,
            },
          });
        }
      }
    };

    window.addEventListener("message", handleMessage, { signal: controller.signal });

    await facebookLogin({
      config_id: config.configId,
      response_type: "code",
      override_default_response_type: true,
      extras: {
        version: "v3",
        featureType: "whatsapp_business_app_onboarding",
        features: [
          { name: "app_only_install" },
          { name: "marketing_messages_lite" },
        ],
      },
    });
  }

  static instance() {
    return new WhatsAppConnectHandler();
  }
}

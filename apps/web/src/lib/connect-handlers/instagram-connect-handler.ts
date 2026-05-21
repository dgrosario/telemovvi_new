import { Channel } from "@omnichannel/core/domain/entities/channel";
import { Action, ConnectHandler } from ".";
import { MetaEmbeddedLoginConfig } from "../gateway-client";

async function fetchMetaConfig(): Promise<MetaEmbeddedLoginConfig | null> {
  try {
    const response = await fetch("/api/meta/embedded-config?channelType=instagram");
    if (!response.ok) {
      console.error("[Instagram] Failed to fetch Meta config:", response.statusText);
      return null;
    }
    return response.json();
  } catch (error) {
    console.error("[Instagram] Error fetching Meta config:", error);
    return null;
  }
}

export class InstagramConnectHandler implements ConnectHandler {
  name = "instagram";

  async connect(channel: Channel.Raw, action: Action): Promise<void> {
    const config = await fetchMetaConfig();

    if (!config) {
      throw new Error("Configurações do Instagram não encontradas. Configure em Sistema > Configurações Meta.");
    }

    const redirectUri = `${window.location.origin}/channels`;
    
    // Log para auxiliar o usuário a configurar corretamente no Painel da Meta
    console.log("[Instagram Connect] Redirect URI gerada:", redirectUri);
    console.log("[Instagram Connect] Adicione esta URL exata em 'URIs de redirecionamento OAuth válidos' no Painel do Facebook.");

    const scopes = [
      "instagram_business_basic",
      "instagram_business_manage_messages",
    ].join(",");

    const url = new URL("https://www.instagram.com/oauth/authorize");
    url.searchParams.append("client_id", config.appId);
    url.searchParams.append("redirect_uri", redirectUri);
    url.searchParams.append("scope", scopes);
    url.searchParams.append("response_type", "code");
    url.searchParams.append("state", channel.id);

    // Calculate position for centered popup
    const width = 600;
    const height = 700;
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    // Open popup
    const popup = window.open(
      url.toString(),
      "Instagram Login",
      `width=${width},height=${height},top=${top},left=${left}`
    );

    if (!popup) {
      throw new Error("Popup bloqueado. Por favor, permita popups para este site.");
    }

    // Wait for message from popup
    return new Promise((resolve, reject) => {
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        const data = event.data;
        if (data && data.type === "INSTAGRAM_CODE" && data.state === channel.id) {
          window.removeEventListener("message", handleMessage);
          
          if (data.error) {
             reject(new Error(data.error_description || data.error));
             return;
          }

          if (data.code) {
             try {
                await action({
                  id: channel.id,
                  type: "instagram",
                  inputPayload: {
                    code: data.code,
                    redirectUri,
                  },
                });
                resolve();
             } catch (error) {
                reject(error);
             }
          } else {
             reject(new Error("Código de autorização não recebido."));
          }
        }
      };

      window.addEventListener("message", handleMessage);
      
      // Optional: Detect popup close to cleanup listener
      const timer = setInterval(() => {
        if (popup.closed) {
          clearInterval(timer);
          window.removeEventListener("message", handleMessage);
          // Resolve without error to just stop loading state if user closed popup manually
          // Or reject if you want to show an error message
          resolve(); 
        }
      }, 1000);
    });
  }

  static instance() {
    return new InstagramConnectHandler();
  }
}

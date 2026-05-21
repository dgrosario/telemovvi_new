import type { FlowResumeConsumer } from "./src/lib/flow-resume-consumer";
import type { GatewayChannelConsumer } from "./src/lib/gateway-channel-consumer";
import type { InboundMessageConsumer } from "./src/lib/inbound-message-consumer";
import type { Server } from "socket.io";

export {};

declare global {
  // Server-side globals
  // eslint-disable-next-line no-var
  var io: Server | undefined;
  // eslint-disable-next-line no-var
  var flowResumeConsumer: FlowResumeConsumer | undefined;
  // eslint-disable-next-line no-var
  var gatewayChannelConsumer: GatewayChannelConsumer | undefined;
  // eslint-disable-next-line no-var
  var inboundMessageConsumer: InboundMessageConsumer | undefined;

  interface Window {
    fbAsyncInit?: () => void;
    FB?: typeof FB;
  }

  namespace FacebookSDK {
    type LoginStatus = "connected" | "not_authorized" | "unknown";

    interface AuthResponse {
      accessToken: string;
      expiresIn: number;
      signedRequest: string;
      userID: string;
      code?: string;
      data_access_expiration_time?: number;
      graphDomain?: string;
      reauthorize_required_in?: number;
    }

    interface LoginStatusResponse {
      authResponse: AuthResponse | null;
      status: LoginStatus;
    }

    interface LoginResponse {
      authResponse: AuthResponse | null;
      status: LoginStatus;
    }

    interface EmbeddedSignupFeature {
      name: string;
    }

    interface EmbeddedSignupExtras {
      version?: string;
      featureType?: string;
      features?: EmbeddedSignupFeature[];
      sessionInfoVersion?: number;
      setup?: Record<string, unknown>;
    }

    interface LoginOptions {
      config_id?: string;
      response_type?: "code" | "token" | "code%20token" | "granted_scopes";
      override_default_response_type?: boolean;
      scope?: string;
      return_scopes?: boolean;
      enable_profile_selector?: boolean;
      profile_selector_ids?: string;
      auth_type?: "reauthenticate" | "reauthorize" | "rerequest";
      extras?: EmbeddedSignupExtras;
    }

    interface InitParams {
      appId: string;
      autoLogAppEvents?: boolean;
      xfbml?: boolean;
      version: string;
      cookie?: boolean;
      localStorage?: boolean;
      status?: boolean;
      frictionlessRequests?: boolean;
    }

    type HttpMethod = "get" | "post" | "delete" | "GET" | "POST" | "DELETE";

    interface GraphAPIError {
      message: string;
      type: string;
      code: number;
      error_subcode?: number;
      error_user_title?: string;
      error_user_msg?: string;
      fbtrace_id?: string;
    }

    interface GraphAPIErrorResponse {
      error: GraphAPIError;
    }

    interface PagingCursors {
      before?: string;
      after?: string;
    }

    interface Paging {
      cursors?: PagingCursors;
      previous?: string;
      next?: string;
    }

    interface GraphAPIListResponse<T> {
      data: T[];
      paging?: Paging;
    }

    interface UserProfile {
      id: string;
      name?: string;
      email?: string;
      first_name?: string;
      last_name?: string;
      picture?: {
        data: {
          url: string;
          width?: number;
          height?: number;
          is_silhouette?: boolean;
        };
      };
    }

    interface Page {
      id: string;
      name: string;
      access_token?: string;
      category?: string;
      category_list?: Array<{ id: string; name: string }>;
      tasks?: string[];
    }

    interface InstagramAccount {
      id: string;
      username?: string;
      name?: string;
      profile_picture_url?: string;
      followers_count?: number;
      follows_count?: number;
      media_count?: number;
    }

    interface WhatsAppBusinessAccount {
      id: string;
      name?: string;
      timezone_id?: string;
      message_template_namespace?: string;
    }

    interface PhoneNumber {
      id: string;
      display_phone_number?: string;
      verified_name?: string;
      quality_rating?: string;
      code_verification_status?: string;
    }

    type GraphAPIResponse<T = Record<string, unknown>> =
      | (T & { error?: never })
      | GraphAPIErrorResponse;

    type GraphAPICallback<T = Record<string, unknown>> = (
      response: GraphAPIResponse<T>
    ) => void;

    interface DebugTokenData {
      app_id: string;
      type: string;
      application: string;
      data_access_expires_at: number;
      expires_at: number;
      is_valid: boolean;
      issued_at?: number;
      scopes: string[];
      granular_scopes?: Array<{
        scope: string;
        target_ids?: string[];
      }>;
      user_id: string;
      error?: GraphAPIError;
    }

    interface DebugTokenResponse {
      data: DebugTokenData;
    }

    interface ExchangeTokenResponse {
      access_token: string;
      token_type: string;
      expires_in?: number;
    }
  }

  interface FBInitParams extends FacebookSDK.InitParams {}

  interface FB {
    init(params: FacebookSDK.InitParams): void;

    getLoginStatus(
      callback: (response: FacebookSDK.LoginStatusResponse) => void,
      roundtrip?: boolean
    ): void;

    login(callback: (response: FacebookSDK.LoginResponse) => void): void;
    login(
      callback: (response: FacebookSDK.LoginResponse) => void,
      options: FacebookSDK.LoginOptions
    ): void;

    logout(callback: (response: FacebookSDK.LoginStatusResponse) => void): void;

    api(path: string, callback: FacebookSDK.GraphAPICallback): void;
    api(
      path: string,
      method: FacebookSDK.HttpMethod,
      callback: FacebookSDK.GraphAPICallback
    ): void;
    api(
      path: string,
      params: Record<string, unknown>,
      callback: FacebookSDK.GraphAPICallback
    ): void;
    api(
      path: string,
      method: FacebookSDK.HttpMethod,
      params: Record<string, unknown>,
      callback: FacebookSDK.GraphAPICallback
    ): void;

    api<T>(path: string, callback: FacebookSDK.GraphAPICallback<T>): void;
    api<T>(
      path: string,
      method: FacebookSDK.HttpMethod,
      callback: FacebookSDK.GraphAPICallback<T>
    ): void;
    api<T>(
      path: string,
      params: Record<string, unknown>,
      callback: FacebookSDK.GraphAPICallback<T>
    ): void;
    api<T>(
      path: string,
      method: FacebookSDK.HttpMethod,
      params: Record<string, unknown>,
      callback: FacebookSDK.GraphAPICallback<T>
    ): void;

    getAuthResponse(): FacebookSDK.AuthResponse | null;

    getAccessToken(): string | null;

    getUserID(): string;

    XFBML: {
      parse(dom?: Element, callback?: () => void): void;
    };

    Event: {
      subscribe(
        event: "auth.login" | "auth.logout" | "auth.statusChange",
        callback: (response: FacebookSDK.LoginStatusResponse) => void
      ): void;
      subscribe(
        event: "auth.authResponseChange",
        callback: (response: FacebookSDK.LoginStatusResponse) => void
      ): void;
      subscribe(event: "xfbml.render", callback: () => void): void;
      unsubscribe(
        event: string,
        callback: (...args: unknown[]) => void
      ): void;
    };

    AppEvents: {
      logEvent(eventName: string, valueToSum?: number, params?: Record<string, unknown>): void;
      logPageView(): void;
      logPurchase(purchaseAmount: number, currency: string, params?: Record<string, unknown>): void;
      setUserID(userID: string): void;
      getUserID(): string;
      clearUserID(): void;
      updateUserProperties(params: Record<string, unknown>): void;
    };
  }

  const FB: FB;
}

let currentAppId: string | null = null;

export const loadFacebookSDK = (appId: string) =>
  new Promise<void>((resolve) => {
    if (window.FB && currentAppId === appId) {
      return resolve();
    }

    if (window.FB && currentAppId !== appId) {
      FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v23.0",
      });
      currentAppId = appId;
      return resolve();
    }

    window.fbAsyncInit = function () {
      FB.init({
        appId,
        autoLogAppEvents: true,
        xfbml: true,
        version: "v23.0",
      });
      currentAppId = appId;
      resolve();
    };

    const id = "facebook-jssdk";
    if (document.getElementById(id)) return;

    const js = document.createElement("script");
    js.id = id;
    js.src = "https://connect.facebook.net/en_US/sdk.js";
    document.body.appendChild(js);
  });

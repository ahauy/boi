const FB_SDK_SRC = "https://connect.facebook.net/vi_VN/sdk.js";

let fbSdkPromise: Promise<void> | null = null;

export const loadFacebookSdk = (appId: string): Promise<void> => {
  if (window.FB) {
    window.FB.init({
      appId,
      cookie: true,
      xfbml: false,
      version: "v19.0",
    });
    return Promise.resolve();
  }

  if (fbSdkPromise) return fbSdkPromise;

  fbSdkPromise = new Promise<void>((resolve, reject) => {
    window.fbAsyncInit = () => {
      if (window.FB) {
        window.FB.init({
          appId,
          cookie: true,
          xfbml: false,
          version: "v19.0",
        });
      }
      resolve();
    };

    const script = document.createElement("script");
    script.src = FB_SDK_SRC;
    script.async = true;
    script.defer = true;
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      fbSdkPromise = null;
      script.remove();
      reject(new Error("Không tải được Facebook SDK"));
    };
    document.head.appendChild(script);
  });

  return fbSdkPromise;
};

interface FacebookAuthResponse {
  accessToken: string;
  userID: string;
  expiresIn: number;
  signedRequest: string;
}

interface FacebookLoginStatusResponse {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: FacebookAuthResponse | null;
}

interface FacebookInitOptions {
  appId: string;
  cookie?: boolean;
  xfbml?: boolean;
  version: string;
}

interface FacebookLoginOptions {
  scope?: string;
  auth_type?: "rerequest" | "reauthenticate" | "reauthorize";
}

interface Window {
  fbAsyncInit?: () => void;
  FB?: {
    init: (options: FacebookInitOptions) => void;
    login: (
      callback: (response: FacebookLoginStatusResponse) => void,
      options?: FacebookLoginOptions
    ) => void;
  };
}

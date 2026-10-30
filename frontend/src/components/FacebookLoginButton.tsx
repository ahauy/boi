import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/components/ui/use-toast";
import BaseUrl from "@/consts/baseUrl";
import { loadFacebookSdk } from "@/helpers/facebookSdk";
import { useAuth } from "@/providers/AuthenticationProvider";
import authService from "@/services/authService";

type ButtonStatus = "ready" | "submitting" | "unavailable";

const DEFAULT_FACEBOOK_APP_ID = "2628413500931399";
const FB_OAUTH_MESSAGE_TYPE = "PALMSIGHT_FB_OAUTH_RESULT";
// `email` lets the API link this login to an existing account with the same email
const FB_SCOPES = "public_profile,email";

const parseOAuthParams = (hash: string, search: string) => {
  const hashParams = new URLSearchParams(hash.replace(/^#/, ""));
  const searchParams = new URLSearchParams(search.replace(/^\?/, ""));
  const accessToken =
    hashParams.get("access_token") || searchParams.get("access_token");
  const error =
    hashParams.get("error_description") ||
    hashParams.get("error_message") ||
    searchParams.get("error_description") ||
    searchParams.get("error_message") ||
    hashParams.get("error") ||
    searchParams.get("error");
  return { accessToken, error };
};

export const FacebookLoginButton = () => {
  const appId =
    import.meta.env.VITE_FACEBOOK_APP_ID ||
    (import.meta.env.MODE === "test" ? "" : DEFAULT_FACEBOOK_APP_ID);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { setAuthSession } = useAuth();
  const [status, setStatus] = useState<ButtonStatus>(
    appId ? "ready" : "unavailable"
  );
  const isSubmittingRef = useRef(false);
  const popupTimerRef = useRef<number | null>(null);

  const clearPopupTimer = useCallback(() => {
    if (popupTimerRef.current !== null) {
      window.clearInterval(popupTimerRef.current);
      popupTimerRef.current = null;
    }
  }, []);

  const submitAccessToken = useCallback(
    async (accessToken: string) => {
      if (isSubmittingRef.current) return;
      isSubmittingRef.current = true;
      clearPopupTimer();
      setStatus("submitting");

      try {
        const storedClaimToken =
          typeof window !== "undefined"
            ? sessionStorage.getItem("ps_claim_token") ||
              localStorage.getItem("ps_claim_token") ||
              undefined
            : undefined;

        const data = await authService.postFacebookLogin({
          accessToken,
          claimToken: storedClaimToken,
        });
        setAuthSession({ accessToken: data.accessToken, user: data.user });

        if (data.claimedReadingId) {
          if (typeof window !== "undefined") {
            sessionStorage.removeItem("ps_claim_token");
            localStorage.removeItem("ps_claim_token");
          }
          navigate(`/readings/${data.claimedReadingId}`);
          return;
        }

        navigate(data.isNewUser ? BaseUrl.ReferralEnter : BaseUrl.Scan);
      } catch (error: any) {
        isSubmittingRef.current = false;
        setStatus("ready");
        toast({
          variant: "destructive",
          description:
            error?.response?.data?.error?.message ||
            "Đăng nhập Facebook thất bại. Vui lòng thử lại.",
        });
      }
    },
    [clearPopupTimer, navigate, setAuthSession, toast]
  );

  useEffect(() => {
    const { accessToken, error } = parseOAuthParams(
      window.location.hash,
      window.location.search
    );

    if (accessToken || error) {
      window.history.replaceState(null, "", window.location.pathname);
      if (window.opener && window.opener !== window) {
        window.opener.postMessage(
          { type: FB_OAUTH_MESSAGE_TYPE, accessToken, error },
          window.location.origin
        );
        window.close();
        return;
      }
      if (accessToken) {
        void submitAccessToken(accessToken);
        return;
      }
      if (error) {
        toast({
          variant: "destructive",
          description: "Đăng nhập Facebook đã bị huỷ hoặc từ chối.",
        });
      }
    }

    if (!appId) {
      setStatus("unavailable");
      return;
    }

    setStatus("ready");
    loadFacebookSdk(appId).catch(() => undefined);

    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== FB_OAUTH_MESSAGE_TYPE) return;

      clearPopupTimer();
      if (event.data.accessToken) {
        void submitAccessToken(String(event.data.accessToken));
      } else {
        isSubmittingRef.current = false;
        setStatus("ready");
        if (event.data.error) {
          toast({
            variant: "destructive",
            description: "Đăng nhập Facebook đã bị huỷ hoặc từ chối.",
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearPopupTimer();
    };
  }, [appId, clearPopupTimer, submitAccessToken, toast]);

  const handleFacebookClick = () => {
    if (status !== "ready" || !appId) return;

    const canUseJsSdk =
      Boolean(window.FB) &&
      (window.location.protocol === "https:" ||
        import.meta.env.MODE === "test");

    if (canUseJsSdk && window.FB) {
      setStatus("submitting");
      window.FB.login(
        (response) => {
          const accessToken = response?.authResponse?.accessToken;
          if (response?.status !== "connected" || !accessToken) {
            setStatus("ready");
            return;
          }
          void submitAccessToken(accessToken);
        },
        //! rerequest asks again for email if the user unticked it on a previous login
        { scope: FB_SCOPES, auth_type: "rerequest" }
      );
      return;
    }

    const redirectUri = `${window.location.origin}${BaseUrl.Login}`;
    const oauthUrl =
      `https://www.facebook.com/v19.0/dialog/oauth` +
      `?client_id=${encodeURIComponent(appId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&response_type=token` +
      `&scope=${encodeURIComponent(FB_SCOPES)}` +
      `&auth_type=rerequest` +
      `&display=popup`;

    const width = 600;
    const height = 680;
    const left = Math.max(
      0,
      Math.round(window.screenX + (window.outerWidth - width) / 2)
    );
    const top = Math.max(
      0,
      Math.round(window.screenY + (window.outerHeight - height) / 2)
    );

    setStatus("submitting");
    const popup = window.open(
      oauthUrl,
      "facebook-oauth-login",
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    if (!popup) {
      window.location.assign(oauthUrl);
      return;
    }

    clearPopupTimer();
    popupTimerRef.current = window.setInterval(() => {
      if (popup.closed) {
        clearPopupTimer();
        if (!isSubmittingRef.current) {
          setStatus("ready");
        }
        return;
      }

      try {
        if (popup.location.origin === window.location.origin) {
          const { accessToken, error } = parseOAuthParams(
            popup.location.hash,
            popup.location.search
          );
          if (accessToken) {
            popup.close();
            void submitAccessToken(accessToken);
          } else if (error) {
            popup.close();
            clearPopupTimer();
            setStatus("ready");
            toast({
              variant: "destructive",
              description: "Đăng nhập Facebook đã bị huỷ hoặc từ chối.",
            });
          }
        }
      } catch {
        return;
      }
    }, 300);
  };

  const isDisabled = status !== "ready";
  const labelText =
    status === "submitting"
      ? "[...] Đang đăng nhập bằng Facebook..."
      : "Đăng nhập bằng Facebook";

  return (
    <button
      type="button"
      onClick={handleFacebookClick}
      disabled={isDisabled}
      title={
        status === "unavailable"
          ? "Đăng nhập Facebook hiện chưa khả dụng"
          : undefined
      }
      className="btn-secondary w-full text-sm disabled:cursor-not-allowed disabled:opacity-60"
    >
      {status !== "submitting" && (
        <span className="mr-1 font-bold text-[#d4af37]">[f]</span>
      )}
      {labelText}
    </button>
  );
};

export default FacebookLoginButton;

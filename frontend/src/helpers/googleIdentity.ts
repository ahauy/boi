const GSI_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

let gsiScriptPromise: Promise<void> | null = null;

//! Load the Google Identity Services script once per page
export const loadGoogleIdentityScript = (): Promise<void> => {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (gsiScriptPromise) return gsiScriptPromise;

  gsiScriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = GSI_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      gsiScriptPromise = null;
      script.remove();
      reject(new Error("Không tải được Google Identity Services"));
    };
    document.head.appendChild(script);
  });

  return gsiScriptPromise;
};

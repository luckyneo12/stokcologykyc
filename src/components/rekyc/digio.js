// Opens a Digio flow (DigiLocker or eSign) with the SDK loaded by the root layout — same
// sequence as the onboarding portal: open the window first (popup blockers), then create the request.
export async function runDigio({ create, logo = "/stklogo.png" }) {
  if (typeof window === "undefined" || !window.Digio) {
    throw new Error("Verification service did not load. Please refresh the page and try again.");
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      try {
        digio?.cancel?.();
      } catch (e) {}
      fn(value);
    };
    const digio = new window.Digio({
      environment: "production",
      logo: `${window.location.origin}${logo}`,
      theme: { primaryColor: "#1e4fbf", secondaryColor: "#0f172a" },
      is_iframe: false,
      callback: (response) => {
        if (response?.error_code) finish(reject, new Error(response.message || "The verification was cancelled."));
        else finish(resolve, response);
      },
    });
    try {
      digio.init();
    } catch (e) {}
    create()
      .then(({ requestId, identifier, accessToken }) => {
        if (accessToken) digio.submit(requestId, identifier, accessToken);
        else digio.submit(requestId, identifier);
      })
      .catch((error) => finish(reject, error));
  });
}

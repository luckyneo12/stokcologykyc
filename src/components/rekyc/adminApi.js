import { API_BASE_URL } from "@/utils/apiConfig";

// ReKYC admin session — its own key, separate from the KYC Admin / Globe / AP portals.
const TOKEN_KEY = "rekycAdminToken";

export function getAdminToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}

function onUnauthorized() {
  setAdminToken(null);
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/rekyc-admin/login")) {
    window.location.href = "/rekyc-admin/login";
  }
}

export async function adminApi(path, { method = "GET", body, formData } = {}) {
  const headers = {};
  const token = getAdminToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rekyc-admin${path}`, {
      method,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    throw new Error("Unable to reach the server. Please check your connection.");
  }
  const data = await response.json().catch(() => ({}));
  if (response.status === 401 && path !== "/auth/login") onUnauthorized();
  if (!response.ok || data.success === false) throw new Error(data.error || "Something went wrong.");
  return data;
}

/** Downloads a protected file (PDF, CSV, image) and opens or saves it. */
export async function adminFile(path, { download = false, filename } = {}) {
  const response = await fetch(`${API_BASE_URL}/api/rekyc-admin${path}`, { headers: { Authorization: `Bearer ${getAdminToken()}` } });
  if (response.status === 401) onUnauthorized();
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "Could not load the file.");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  if (download) {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || "download";
    a.click();
  } else {
    window.open(url, "_blank", "noopener");
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

export function toQuery(params) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") q.set(k, v);
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

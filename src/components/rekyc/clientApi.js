import { API_BASE_URL } from "@/utils/apiConfig";

// ReKYC client session. Kept in sessionStorage under ReKYC-only keys, so it never mixes
// with the KYC portal's tokens (kycToken / token / adminToken).
const TOKEN_KEY = "rekycClientToken";

export function getClientToken() {
  try {
    return sessionStorage.getItem(TOKEN_KEY);
  } catch (e) {
    return null;
  }
}

export function setClientToken(token) {
  try {
    if (token) sessionStorage.setItem(TOKEN_KEY, token);
    else sessionStorage.removeItem(TOKEN_KEY);
  } catch (e) {}
}

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function rekycApi(path, { method = "GET", body, formData } = {}) {
  const token = getClientToken();
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/api/rekyc${path}`, {
      method,
      headers,
      body: formData || (body !== undefined ? JSON.stringify(body) : undefined),
    });
  } catch (e) {
    throw new ApiError("Unable to connect. Please check your internet connection.", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) {
    if (response.status === 401 && path !== "/auth/verify-otp") {
      setClientToken(null);
      if (typeof window !== "undefined") window.location.href = "/rekyc";
    }
    throw new ApiError(data.error || "Something went wrong. Please try again.", response.status, data.code);
  }
  return data;
}

export async function downloadSignedForm() {
  const response = await fetch(`${API_BASE_URL}/api/rekyc/esign/download`, { headers: { Authorization: `Bearer ${getClientToken()}` } });
  if (!response.ok) throw new ApiError("The signed form is not available yet.", response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Modification_Form.pdf";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

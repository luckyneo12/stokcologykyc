import { API_BASE_URL } from "@/utils/kycApi";

/**
 * Document upload for the correction portal only. Same endpoint and result as kycApi's uploadDocument,
 * but authenticates with the correction link's token: the shared helper only sends the normal-portal
 * login token, which a user opening the correction email link may not have in this browser.
 */
export const uploadCorrectionDocument = async (file) => {
  if (!file) throw new Error("No file provided");
  const token = typeof window !== "undefined" ? sessionStorage.getItem("correctionToken") : null;
  const formData = new FormData();
  formData.append("document", file);

  const response = await fetch(`${API_BASE_URL}/api/kyc/upload-document`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to upload document");
  }
  return result;
};

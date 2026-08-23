/**
 * Digio SDK Utility
 * Handles Digio Web SDK initialization + backend request orchestration.
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getAuthToken = () => {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem("kycToken")
    || localStorage.getItem("kycToken")
    || localStorage.getItem("adminToken")
    || localStorage.getItem("token")
  );
};

const getApplicationId = () => {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("kycApplicationId") || localStorage.getItem("kycApplicationId");
};

const getAuthHeaders = () => {
  const token = getAuthToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const initializeDigio = (options) => {
  const {
    environment = "production",
    callback,
    logoUrl = "",
    theme = { primaryColor: "#9fe870", secondaryColor: "#1a1a1a" },
    is_redirection_approach = false,
    redirect_url = "",
  } = options;

  if (typeof window !== "undefined" && window.Digio) {
    try {
      const digioOptions = {
        environment,
        callback,
        logo: logoUrl,
        theme,
        is_iframe: false,
      };

      if (is_redirection_approach && redirect_url) {
        digioOptions.is_redirection_approach = true;
        digioOptions.redirect_url = redirect_url;
      }

      return new window.Digio(digioOptions);
    } catch (error) {
      console.error("Error creating Digio instance:", error);
      return null;
    }
  }

  console.error("Digio SDK not loaded. Make sure the script is included in layout.js");
  return null;
};

export const createDigioRequest = async (type, data = {}) => {
  const url = `${API_BASE_URL}/api/digio/create-request`;
  const body = JSON.stringify({
    type,
    data,
    applicationId: getApplicationId() || undefined,
  });

  console.log(`[Digio Utility] Sending ${type} request to ${url} (Payload: ${(body.length / 1024).toFixed(2)} KB)`);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(),
      body: body,
    }).catch(err => {
      console.error("[Digio Utility] Fetch failed immediately:", err);
      if (err.name === 'TypeError' && err.message === 'Failed to fetch') {
        throw new Error(`Connection to API failed at ${API_BASE_URL}. Please ensure the server is running and accessible.`);
      }
      throw err;
    });

    const result = await response.json().catch(() => ({ success: false, error: "Invalid JSON response from server" }));
    
    if (!response.ok || !result.success || !result.id) {
      console.error("[Digio Utility] Server Error:", result);
      throw new Error(result.error || `Failed to create Digio request (${response.status})`);
    }

    if (result.applicationId && typeof window !== "undefined") {
      localStorage.setItem("kycApplicationId", result.applicationId);
    }

    return {
      requestId: result.id,
      customerIdentifier: result.customer_identifier,
      applicationId: result.applicationId,
      accessToken: (typeof result.access_token === 'object' ? result.access_token?.id : result.access_token),
      raw: result,
    };
  } catch (error) {
    console.error("Digio Utility Error:", error);
    throw error;
  }
};

export const fetchDigioRequestResponse = async (requestId, type) => {
  if (!requestId) return null;
  try {
    const response = await fetch(`${API_BASE_URL}/api/digio/request-response/${requestId}`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        applicationId: getApplicationId() || undefined,
        type,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to fetch Digio response");
    }
    return result;
  } catch (error) {
    console.error("Digio Response Utility Error:", error);
    return null;
  }
};

export const verifyPanDirect = async (pan, fullName, dob) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/digio/verify-pan`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        pan,
        fullName,
        dob,
        applicationId: getApplicationId() || undefined,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.message || result.error || "Failed to verify PAN");
    }

    if (result.applicationId && typeof window !== "undefined") {
      localStorage.setItem("kycApplicationId", result.applicationId);
    }

    return result;
  } catch (error) {
    console.error("PAN Verification Utility Error:", error);
    throw error;
  }
};

export const verifyBank = async (accountNumber, ifsc, beneficiaryName, accountType) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/digio/verify-bank`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        accountNumber,
        ifsc,
        beneficiaryName,
        accountType,
        applicationId: getApplicationId() || undefined,
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to verify bank account");
    }
    return result;
  } catch (error) {
    console.error("Bank Verification Utility Error:", error);
    throw error;
  }
};

export const verifyIfsc = async (ifscCode) => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/digio/verify-ifsc`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({ ifscCode }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to verify IFSC");
    }
    return result;
  } catch (error) {
    console.error("IFSC Verification Utility Error:", error);
    throw error;
  }
};

export const maskAadhaarImage = async (base64Data, contentType = "PNG", fileName = "aadhaar.png") => {
  try {
    const response = await fetch(`${API_BASE_URL}/api/digio/mask-aadhaar`, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        data: base64Data,
        data_content_type: contentType,
        file_name: fileName,
        consent: "yes"
      }),
    });

    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to mask Aadhaar image");
    }
    return result;
  } catch (error) {
    console.error("Aadhaar Masking Utility Error:", error);
    throw error;
  }
};

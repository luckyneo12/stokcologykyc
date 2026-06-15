const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const getToken = () => {
  if (typeof window === "undefined") return null;
  return (
    sessionStorage.getItem("kycToken")
    || sessionStorage.getItem("adminToken")
    || sessionStorage.getItem("token")
  );
};

const authHeaders = () => {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export const sendOtp = async (phone, apCode) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, apCode }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to send OTP");
  }
  return result;
};

export const verifyOtp = async (phone, otp, apCode) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp, apCode }),
  });
  const result = await response.json();
  if (!response.ok || !result.success || !result.token) {
    throw new Error(result.error || "Failed to verify OTP");
  }
  return result;
};

export const sendEmailOtp = async (email) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/send-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to send email OTP");
  }
  return result;
};

export const verifyEmailOtp = async (email, otp) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/verify-otp`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to verify email OTP");
  }
  return result;
};

export const startKycApplication = async () => {
  const response = await fetch(`${API_BASE_URL}/api/kyc/start`, {
    method: "POST",
    headers: authHeaders(),
  });
  const result = await response.json();
  if (!response.ok || !result.success || !result.applicationId) {
    throw new Error(result.error || "Failed to start KYC application");
  }
  return result;
};

export const saveKycStep = async ({ applicationId, step, stepIndex, data }) => {
  if (!applicationId) return null;

  const response = await fetch(`${API_BASE_URL}/api/kyc/save-step`, {
    method: "PUT",
    headers: authHeaders(),
    body: JSON.stringify({
      applicationId,
      step,
      stepIndex,
      data,
    }),
  });

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const result = await response.json();
    if (!response.ok || !result.success) {
      throw new Error(result.error || "Failed to save KYC progress");
    }
    return result;
  } else {
    const text = await response.text();
    console.error("[KYC API] Non-JSON response:", text);
    throw new Error(`Server Error: ${response.status} ${response.statusText}`);
  }
};

export const uploadDocument = async (file) => {
  if (!file) throw new Error("No file provided");
  const formData = new FormData();
  formData.append("document", file);

  const response = await fetch(`${API_BASE_URL}/api/kyc/upload-document`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getToken()}`,
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to upload document");
  }
  return result;
};

export const submitKyc = async ({ applicationId, data }) => {
  if (!applicationId) {
    throw new Error("Missing applicationId");
  }

  const response = await fetch(`${API_BASE_URL}/api/kyc/submit`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ applicationId, data }),
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.error || "Failed to submit KYC");
  }
  return result;
};

export const getPincodeData = async (pin) => {
  if (!pin || pin.length !== 6) return null;
  const response = await fetch(`${API_BASE_URL}/api/kyc/pincode/${pin}`, {
    headers: authHeaders(),
  });
  if (!response.ok) return null;
  const result = await response.json();
  return result;
};


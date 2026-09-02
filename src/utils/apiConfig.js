/**
 * Centralized API Configuration
 * All frontend files should import API_BASE_URL from here.
 * 
 * In production (Vercel), set the NEXT_PUBLIC_API_URL environment variable
 * to your backend URL (e.g., https://springgreen-duck-136962.hostingersite.com)
 * 
 * In development, it falls back to http://localhost:5000
 */
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

/**
 * Helper to resolve asset/upload paths from the backend.
 * Handles paths that are already full URLs, data URIs, or relative paths.
 */
export function resolveAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  
  // Handle old Cloudinary paths saved as local paths without extensions
  if (path.includes("kyc_uploads/")) {
    const filename = path.split("/").pop();
    const hasExtension = filename.includes(".");
    const ext = hasExtension ? "" : ".jpg";
    return `https://res.cloudinary.com/dogfk2nyq/image/upload/v1/kyc_uploads/${filename}${ext}`;
  }

  // Replace windows backslashes with forward slashes
  let normalizedPath = path.replace(/\\/g, "/");
  // Ensure it starts with a slash
  if (!normalizedPath.startsWith("/")) {
    normalizedPath = "/" + normalizedPath;
  }
  // Map local /uploads paths to the secure /api/kyc/document endpoint
  if (normalizedPath.startsWith("/uploads/")) {
    normalizedPath = normalizedPath.replace("/uploads/", "/api/kyc/document/");
  }
  
  let finalUrl = `${API_BASE_URL}${normalizedPath}`;
  
  // Attach token for secure local routes to bypass 401 Unauthorized in standard <img> tags
  if (finalUrl.includes("/api/kyc/document/")) {
    try {
      const token = typeof window !== "undefined"
        ? (sessionStorage.getItem("kycToken") || sessionStorage.getItem("adminToken") || sessionStorage.getItem("token") || localStorage.getItem("adminToken"))
        : null;
      if (token && !finalUrl.includes("token=")) {
        const separator = finalUrl.includes("?") ? "&" : "?";
        finalUrl = `${finalUrl}${separator}token=${token}`;
      }
    } catch (e) {}
  }
  
  return finalUrl;
}

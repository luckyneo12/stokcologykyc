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
  return `${API_BASE_URL}${normalizedPath}`;
}

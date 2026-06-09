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
  return `${API_BASE_URL}${path}`;
}

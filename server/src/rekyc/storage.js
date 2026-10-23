const axios = require("axios");
const crypto = require("crypto");
const cloudinary = require("cloudinary").v2;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const FOLDER = "rekyc_uploads";

function uploadBuffer(buffer, baseName, { format } = {}) {
  const publicId = `${String(baseName).replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: FOLDER, public_id: publicId, resource_type: "auto", ...(format ? { format } : {}) },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

function signedDownloadUrl(url) {
  const parsed = new URL(url);
  const match = parsed.pathname.match(/\/(image|video|raw)\/upload\/(?:v\d+\/)?(.+)$/);
  if (!match) return null;
  const ext = match[2].match(/\.([^.]+)$/)?.[1] || "pdf";
  const publicId = match[2].replace(/\.[^.]+$/, "");
  return cloudinary.utils.private_download_url(publicId, ext, { resource_type: match[1], type: "upload", attachment: false });
}

/** Downloads a stored file (plain URL first, then a signed Cloudinary URL for restricted assets). */
async function fetchBuffer(url) {
  try {
    const res = await axios.get(url, { responseType: "arraybuffer", timeout: 60000 });
    return { buffer: Buffer.from(res.data), contentType: res.headers["content-type"] };
  } catch (error) {
    if (!String(url).startsWith("https://res.cloudinary.com/")) throw error;
    const signed = signedDownloadUrl(url);
    if (!signed) throw error;
    const res = await axios.get(signed, { responseType: "arraybuffer", timeout: 60000 });
    return { buffer: Buffer.from(res.data), contentType: res.headers["content-type"] };
  }
}

module.exports = { uploadBuffer, fetchBuffer };

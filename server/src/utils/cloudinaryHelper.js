const cloudinary = require("cloudinary").v2;

/**
 * Extracts the public_id from a Cloudinary URL and deletes it from Cloudinary.
 * @param {string} url The full Cloudinary URL to delete
 */
const deleteCloudinaryFile = async (url) => {
  if (!url || typeof url !== "string" || !url.includes("cloudinary.com")) return;
  
  try {
    // Example URL: https://res.cloudinary.com/cloudname/image/upload/v1234567890/folder/filename.jpg
    const match = /\/upload\/(?:v\d+\/)?([^\.]+)/.exec(url);
    if (!match || !match[1]) return;
    
    const publicId = match[1];
    
    // Non-blocking background deletion
    cloudinary.uploader.destroy(publicId).catch(err => {
      console.error(`[Cloudinary Cleanup] Failed to delete ${publicId}:`, err.message);
    });
    console.log(`[Cloudinary Cleanup] Scheduled deletion for orphaned file: ${publicId}`);
  } catch (err) {
    console.error(`[Cloudinary Cleanup] Error parsing URL ${url}:`, err.message);
  }
};

module.exports = {
  deleteCloudinaryFile
};

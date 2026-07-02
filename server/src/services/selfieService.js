const digioClient = require("./digioClient");

/**
 * Selfie & Liveness Verification Service
 */
class SelfieService {
  /**
   * Create a Liveness verification request
   */
  async createRequest(customerIdentifier, customerName = "") {
    const endpoint = "client/kyc/v2/request";
    
    return await digioClient.post(endpoint, {
      customer_identifier: customerIdentifier,
      customer_name: customerName || "KYC User",
      notify_customer: false,
      generate_access_token: true,
      actions: [
        {
          type: "SELFIE",
          title: "Selfie Verification",
          description: "Capture a live selfie to verify your identity"
        }
      ]
    });
  }

  /**
   * Compare two faces (e.g. Selfie vs ID Card)
   */
  async faceMatch(image1, image2) {
    const endpoint = "v3/client/kyc/face/match";
    
    return await digioClient.post(endpoint, {
      image1: image1, // Base64 or URL
      image2: image2,
    });
  }
}

module.exports = new SelfieService();

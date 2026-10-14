const digioClient = require("./digioClient");

// Digio workflow used for the selfie request (override with DIGIO_SELFIE_WORKFLOW in .env).
// Digio's with_template API takes the workflow NAME, not its ID (KTP…) — an ID gives "Template not found".
// ONLY_SELFIE_FLOW has just the selfie step. Don't use DIGILOCKER_CONDITIONAL_JOURNEY_PAN_V0702
// (KTP251129130344112KVAZBQHT3474J9) here — it makes the user redo DigiLocker and PAN first.
const SELFIE_WORKFLOW = process.env.DIGIO_SELFIE_WORKFLOW || "ONLY_SELFIE_FLOW";

/**
 * Selfie & Liveness Verification Service
 */
class SelfieService {
  /**
   * Create a Liveness verification request
   */
  async createRequest(customerIdentifier, customerName = "") {
    return await digioClient.createKycRequest({
      customer_identifier: customerIdentifier,
      customer_name: customerName || "KYC User",
      template_name: SELFIE_WORKFLOW,
      notify_customer: false,
      generate_access_token: true,
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

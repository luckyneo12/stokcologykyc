const digioClient = require("./digioClient");

// Digio workflow used for the selfie request (override with DIGIO_SELFIE_WORKFLOW in .env).
// Digio's with_template API takes the workflow NAME, not its ID (KTP…) — an ID gives "Template not found".
// Current: DIGILOCKER_CONDITIONAL_JOURNEY_PAN_V0702_Clone (workflow ID KTP261015125945597T2VGAMF6ZUG3F1) —
// selfie-only clone of the combined journey.
// Others: DIGILOCKER_CONDITIONAL_JOURNEY_PAN_V0702 (KTP251129130344112KVAZBQHT3474J9) = full journey, Digio
// shows DigiLocker → PAN → Selfie; ONLY_SELFIE_FLOW (KTP261015120630980SP6NLBS3LITVIS).
const SELFIE_WORKFLOW = process.env.DIGIO_SELFIE_WORKFLOW || "DIGILOCKER_CONDITIONAL_JOURNEY_PAN_V0702_Clone";
// Digio's standard selfie-only template — not yet enabled on our account ("Template with name: SELFIE_KYC
// not found"). Once Digio enables it, uncomment this and comment out the line above:
// const SELFIE_WORKFLOW = process.env.DIGIO_SELFIE_WORKFLOW || "SELFIE_KYC";

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

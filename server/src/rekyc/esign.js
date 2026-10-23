const FormData = require("form-data");
const digioClient = require("../services/digioClient");
const esignService = require("../services/esignService");

// Aadhaar eSign of the modification form through Digio (same API as the onboarding eSign,
// but with the ReKYC PDF instead of the account opening form).

async function createSignRequest({ pdfBuffer, identifier, signerName, fileName }) {
  const request = {
    signature_type: "aadhaar",
    signers: [
      {
        identifier,
        name: signerName || "Client",
        reason: "Client modification request (ReKYC)",
        sign_type: "aadhaar",
        name_match: true,
        display_on_page: "all",
      },
    ],
    expire_in_days: 10,
    display_on_page: "all",
    notify_signers: false,
    send_sign_link: false,
    generate_access_token: true,
  };

  const form = new FormData();
  form.append("file", pdfBuffer, { filename: fileName, contentType: "application/pdf" });
  form.append("request", JSON.stringify(request), { contentType: "application/json" });

  try {
    return await digioClient.post("v2/client/document/upload", form, { headers: form.getHeaders(), timeout: 120000 });
  } catch (error) {
    const data = error.response?.data || {};
    throw new Error(data.message || error.message || "Could not start the eSign");
  }
}

function aadhaarSuffix(value) {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/** Same rule as onboarding: the Aadhaar that signed must be the client's Aadhaar (when both are known). */
function checkSigner(details, expectedSuffix) {
  const signed = (Array.isArray(details?.signing_parties) ? details.signing_parties : [])
    .filter((p) => String(p?.status || "").toLowerCase() === "signed")
    .map((p) => ({ suffix: aadhaarSuffix(p?.pki_signature_details?.aadhaar_suffix), name: p?.pki_signature_details?.name || p?.name || null }));
  if (!signed.length) return { status: "not_signed" };
  const withSuffix = signed.filter((p) => p.suffix);
  if (!withSuffix.length || !expectedSuffix) {
    return { status: "unavailable", signedSuffix: withSuffix[0]?.suffix || null, signerName: signed[0].name, expectedSuffix: expectedSuffix || null };
  }
  const wrong = withSuffix.find((p) => p.suffix !== expectedSuffix);
  if (wrong) return { status: "mismatch", signedSuffix: wrong.suffix, expectedSuffix, signerName: wrong.name };
  return { status: "matched", signedSuffix: withSuffix[0].suffix, expectedSuffix, signerName: withSuffix[0].name };
}

module.exports = {
  createSignRequest,
  checkSigner,
  getDetails: (documentId) => esignService.getRequestDetails(documentId),
  download: (documentId) => esignService.downloadDocument(documentId),
};

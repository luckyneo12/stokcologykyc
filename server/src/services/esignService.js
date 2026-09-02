const digioClient = require("./digioClient");
const { generateKycPdf } = require("../utils/pdfGenerator");

/**
 * Aadhaar eSign Service
 */
class EsignService {
  /**
   * Creates an Aadhaar eSign request for a document.
   * Generates the PDF on the backend to avoid payload size issues.
   */
  async createRequest(customerIdentifier, aadhaar, applicationData = {}) {
    const FormData = require('form-data');
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    
    // Re-fetch fresh application data from DB to include all corrections
    // (critical for resubmission flows where user updated rejected fields)
    if (applicationData.id) {
      try {
        const freshApp = await prisma.kycApplication.findUnique({
          where: { id: applicationData.id },
          include: { user: true },
        });
        if (freshApp) {
          Object.assign(applicationData, freshApp);
          console.log(`[EsignService] Refreshed application data from DB for ID: ${applicationData.id}`);
        }
      } catch (dbErr) {
        console.warn(`[EsignService] Could not refresh from DB, using passed data:`, dbErr.message);
      }
    }

    if (applicationData.correctionDraft) {
      try {
        const cDraft = typeof applicationData.correctionDraft === 'string' ? JSON.parse(applicationData.correctionDraft) : applicationData.correctionDraft;
        const drafts = cDraft?.drafts || {};
        
        const safeParse = (val) => {
          if (typeof val !== 'string') return val;
          try { return JSON.parse(val || "{}"); } catch(e) { return val; }
        };

        const mergedApp = {
          personalDetails: safeParse(applicationData.personalDetails),
          identityDetails: safeParse(applicationData.identityDetails),
          address: safeParse(applicationData.address),
          bankDetails: safeParse(applicationData.bankDetails),
          nomineeDetails: safeParse(applicationData.nomineeDetails),
          ocrData: safeParse(applicationData.ocrData),
          selfieDetails: safeParse(applicationData.selfieDetails),
          documents: safeParse(applicationData.documents),
          panUpload: applicationData.panUpload,
          financialProof: applicationData.financialProof,
          selfie: applicationData.selfie,
          signature: applicationData.signature,
        };

        Object.entries(drafts).forEach(([stepId, draftData]) => {
           if (!draftData) return;
           if (stepId === 'digilocker') {
              if (draftData.identityDetails) mergedApp.identityDetails = { ...mergedApp.identityDetails, ...draftData.identityDetails };
              if (draftData.address) mergedApp.address = { ...mergedApp.address, ...draftData.address };
              if (draftData.personalDetails) mergedApp.personalDetails = { ...mergedApp.personalDetails, ...draftData.personalDetails };
           } else if (stepId === 'pricingSelection') {
              mergedApp.segments = draftData.segments;
              mergedApp.bsda = draftData.bsda;
           } else if (stepId === 'personalDetails') {
              mergedApp.personalDetails = { ...mergedApp.personalDetails, ...draftData };
           } else if (stepId === 'pepProof') {
              mergedApp.personalDetails = { ...mergedApp.personalDetails, pepProof: draftData.path || draftData.preview };
           } else if (stepId === 'bankVerification') {
              mergedApp.bankDetails = { ...mergedApp.bankDetails, ...draftData };
           } else if (stepId === 'nomineeChoice' || stepId === 'nomineeDetails' || stepId.startsWith('nominee') || stepId.startsWith('guardian')) {
              if (stepId === 'nomineeAllocation') {
                 mergedApp.nomineeAllocation = draftData;
              } else if (stepId.endsWith('Proof')) {
                 if (!mergedApp.nomineeDetails) mergedApp.nomineeDetails = {};
                 if (!mergedApp.nomineeDetails.nominees) mergedApp.nomineeDetails.nominees = [];
                 
                 let idx = 0;
                 if (stepId.startsWith('nominee')) {
                    idx = parseInt(stepId.replace('nominee', '').replace('Proof', '')) - 1;
                    if (!mergedApp.nomineeDetails.nominees[idx]) mergedApp.nomineeDetails.nominees[idx] = {};
                    mergedApp.nomineeDetails.nominees[idx].proofPath = draftData.path || draftData.filePreview || draftData.preview;
                 } else if (stepId.startsWith('guardian')) {
                    idx = parseInt(stepId.replace('guardian', '').replace('Proof', '')) - 1;
                    if (!mergedApp.nomineeDetails.nominees[idx]) mergedApp.nomineeDetails.nominees[idx] = {};
                    mergedApp.nomineeDetails.nominees[idx].guardianProofPath = draftData.path || draftData.filePreview || draftData.preview;
                 }
              } else {
                 const actualDraftData = draftData.nomineeDetails ? draftData.nomineeDetails : draftData;
                 if (actualDraftData.nominees && actualDraftData.nominees.length > 0) actualDraftData.opted = "Yes";
                 mergedApp.nomineeDetails = { ...mergedApp.nomineeDetails, ...actualDraftData };
              }
           } else if (stepId === 'panVerification') {
              mergedApp.identityDetails = { ...mergedApp.identityDetails, ...draftData };
           } else if (stepId === 'financialProof') {
              mergedApp.financialProof = draftData;
           } else if (stepId === 'signature') {
              mergedApp.signature = draftData;
           } else if (stepId === 'panUpload') {
              mergedApp.panUpload = draftData;
           } else if (stepId === 'ipv') {
              mergedApp.selfieDetails = { ...mergedApp.selfieDetails, ...draftData };
           }
        });
        
        Object.assign(applicationData, {
           personalDetails: JSON.stringify(mergedApp.personalDetails),
           identityDetails: JSON.stringify(mergedApp.identityDetails),
           address: JSON.stringify(mergedApp.address),
           bankDetails: JSON.stringify(mergedApp.bankDetails),
           nomineeDetails: JSON.stringify(mergedApp.nomineeDetails),
           ocrData: JSON.stringify(mergedApp.ocrData),
           selfieDetails: JSON.stringify(mergedApp.selfieDetails),
           documents: JSON.stringify(mergedApp.documents),
           panUpload: mergedApp.panUpload,
           financialProof: mergedApp.financialProof,
           selfie: mergedApp.selfie,
           signature: mergedApp.signature,
           segments: mergedApp.segments ? JSON.stringify(mergedApp.segments) : applicationData.segments,
           bsda: mergedApp.bsda !== undefined ? mergedApp.bsda : applicationData.bsda,
           nomineeAllocation: mergedApp.nomineeAllocation ? JSON.stringify(mergedApp.nomineeAllocation) : applicationData.nomineeAllocation
        });
        console.log(`[EsignService] Temporarily merged correctionDraft into applicationData for PDF generation`);
      } catch (err) {
        console.warn(`[EsignService] Failed to merge correction drafts for PDF generation:`, err.message);
      }
    }

    // 1. Generate the PDF locally on the server
    console.log(`[EsignService] Generating PDF for ${customerIdentifier}...`);
    const genResult = await generateKycPdf(applicationData, { extractEsignCoordinates: true });
    const pdfBase64 = genResult.pdfBase64 || genResult;
    const esignCoordinatesMap = genResult.esignCoordinatesMap || {};
    
    // Clean up coordinates to exactly match Digio's expected format (llx, lly, urx, ury)
    const signCoordinates = {};
    for (const [page, coordsArray] of Object.entries(esignCoordinatesMap)) {
      signCoordinates[page] = coordsArray.map(c => ({
        llx: c.x,
        lly: c.y,
        urx: c.x + c.width,
        ury: c.y + c.height
      }));
    }

    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // If there are custom coordinates, we must switch to display_on_page: "custom"
    // and manually inject the bottom-of-page signature for every page.
    let displayOnPage = "all";
    if (Object.keys(signCoordinates).length > 0) {
      displayOnPage = "custom";
      const { PDFDocument } = require('pdf-lib');
      const pdfDoc = await PDFDocument.load(pdfBuffer);
      const totalPages = pdfDoc.getPageCount();
      
      for (let i = 1; i <= totalPages; i++) {
        const pageNum = String(i);
        if (!signCoordinates[pageNum]) signCoordinates[pageNum] = [];
        
        // Add bottom-right default Digio stamp coordinates (Standard A4 bottom right) on EVERY page as requested by user
        signCoordinates[pageNum].push({
          llx: 400,
          lly: 20,
          urx: 550,
          ury: 70
        });
      }
    }

    // 2. Prepare Digio Request (Multipart DID Flow)
    const endpoint = "v2/client/document/upload";
    
    // Parse personal details string
    let parsedPersonalDetails = {};
    try {
      if (typeof applicationData.personalDetails === 'string') {
        parsedPersonalDetails = JSON.parse(applicationData.personalDetails) || {};
      } else if (typeof applicationData.personalDetails === 'object' && applicationData.personalDetails !== null) {
        parsedPersonalDetails = applicationData.personalDetails;
      }
    } catch (e) {
      console.warn("Failed to parse personalDetails for eSign name");
    }

    const requestDetails = {
      signature_type: "aadhaar",
      signers: [
        {
          identifier: customerIdentifier,
          name: parsedPersonalDetails.fullName || "KYC User",
          reason: "KYC Application Signing",
          sign_type: "aadhaar",
          name_match: true,
          ...(Object.keys(signCoordinates).length > 0 && { sign_coordinates: signCoordinates })
        }
      ],
      expire_in_days: 10,
      display_on_page: displayOnPage,
      notify_signers: true,
      send_sign_link: false,
      generate_access_token: true
    };

    let parsedIdentityDetails = {};
    try {
      if (typeof applicationData.identityDetails === 'string') {
        parsedIdentityDetails = JSON.parse(applicationData.identityDetails);
      } else if (typeof applicationData.identityDetails === 'object') {
        parsedIdentityDetails = applicationData.identityDetails;
      }
    } catch (e) {
      console.warn("Failed to parse identityDetails");
    }
    const panNumber = parsedIdentityDetails.pan || customerIdentifier;

    const form = new FormData();
    form.append('file', pdfBuffer, { filename: `KYC_Application_${panNumber}.pdf`, contentType: 'application/pdf' });
    form.append('request', JSON.stringify(requestDetails), { contentType: 'application/json' });

    console.log(`[EsignService] Uploading generated PDF via multipart for ${customerIdentifier} (Buffer size: ${pdfBuffer.length} bytes)`);
    
    try {
      // Pass the form and custom headers to the digioClient.post wrapper
      // Use 120s timeout for large PDF uploads (55+ pages with annexures)
      const response = await digioClient.post(endpoint, form, {
        headers: {
          ...form.getHeaders()
        },
        timeout: 120000
      });
      console.log(`[EsignService] Digio Request Created: ${response.id}`);
      return { ...response, pdfBase64 };
    } catch (error) {
      const errorData = error.response?.data || {};
      console.error(`[EsignService] Digio API Error [${error.response?.status}]:`, JSON.stringify(errorData, null, 2));
      throw new Error(errorData.message || error.message || "Failed to create eSign request");
    }
  }

  /**
   * Get details of a sign request/document
   */
  async getRequestDetails(docId) {
    const endpoint = `v2/client/document/${docId}`;
    return await digioClient.get(endpoint);
  }

  /**
   * Cancel a pending sign request
   */
  async cancelRequest(docId) {
    const endpoint = `v2/client/document/${docId}/cancel`;
    return await digioClient.post(endpoint, {});
  }

  /**
   * Download the signed document
   * Returns a buffer/stream
   */
  async downloadDocument(docId) {
    const endpoint = `v2/client/document/download?document_id=${docId}`;
    return await digioClient.http.get(endpoint, { responseType: 'arraybuffer' });
  }
}

module.exports = new EsignService();

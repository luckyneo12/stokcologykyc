const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

function getVariableValue(variableName, appData) {
  const safeJsonParse = (str) => {
    try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return str; }
  };

  const pDetails = safeJsonParse(appData.personalDetails) || {};
  const iDetails = safeJsonParse(appData.identityDetails) || {};
  const aDetails = safeJsonParse(appData.address) || {};
  const bDetails = safeJsonParse(appData.bankDetails) || {};
  
  switch(variableName) {
    case 'applicationId': return appData.applicationId;
    case 'status': return appData.status;
    case 'plan': return safeJsonParse(appData.pricingPlan)?.name || 'Standard';
    case 'fullName': return pDetails.fullName;
    case 'fatherName': return pDetails.fatherName;
    case 'motherName': return pDetails.motherName;
    case 'dob': return pDetails.dob;
    case 'gender': return pDetails.gender;
    case 'pan': return iDetails.pan;
    case 'aadhaar': return iDetails.aadhaar;
    case 'maritalStatus': return pDetails.maritalStatus;
    case 'occupation': return pDetails.occupation;
    case 'annualIncome': return pDetails.incomeRange || pDetails.annualIncome;
    case 'nationality': return pDetails.nationality || 'Indian';
    case 'residentialStatus': return pDetails.residentialStatus || 'Resident Individual';
    case 'email': return appData.email || pDetails.email || appData.user?.email;
    case 'phone': return appData.phone || pDetails.phone || appData.user?.phone;
    case 'addressLine1': return aDetails.line1;
    case 'addressLine2': return aDetails.line2;
    case 'city': return aDetails.city;
    case 'state': return aDetails.state;
    case 'pincode': return aDetails.pincode;
    case 'fullAddress': 
      const addr = `${aDetails.line1 || ''}, ${aDetails.line2 || ''}, ${aDetails.city || ''}, ${aDetails.state || ''} - ${aDetails.pincode || ''}`;
      return addr.replace(/^[,\s]+|[,\s]+$/g, '');
    case 'bankName': return bDetails.bankName;
    case 'accountNumber': return bDetails.accountNumber;
    case 'ifsc': return bDetails.ifsc;
    case 'accountType': return bDetails.accountType || 'Savings';
    default: return '';
  }
}

async function generateKycPdf(applicationData) {
  try {
    const safeJsonParse = (str) => {
      try { return typeof str === 'string' ? JSON.parse(str) : str; } catch { return str; }
    };

    const parsedSelfieDetails = safeJsonParse(applicationData.selfieDetails) || {};
    const parsedSignature = safeJsonParse(applicationData.signature) || {};
    const parsedDocuments = safeJsonParse(applicationData.documents) || [];
    const parsedPanUpload = safeJsonParse(applicationData.panUpload) || {};
    const parsedFinancialProof = safeJsonParse(applicationData.financialProof) || {};
    const parsedBankDetails = safeJsonParse(applicationData.bankDetails) || {};
    const parsedPersonalDetails = safeJsonParse(applicationData.personalDetails) || {};
    const parsedNomineeDetails = safeJsonParse(applicationData.nomineeDetails) || {};

    // Check if an active template exists
    const activeTemplate = await prisma.pdfTemplate.findFirst({
      where: { isActive: true }
    });

    let officialPdfPath = path.join(__dirname, '../../../public/official_form.pdf');
    if (activeTemplate && activeTemplate.basePdfUrl) {
      // Strip leading slash to prevent path.join from treating it as an absolute path
      const safeRelPath = activeTemplate.basePdfUrl.replace(/^\/+/, '');
      const candidatePath = path.join(__dirname, '../../', safeRelPath);
      if (fs.existsSync(candidatePath)) officialPdfPath = candidatePath;
    }

    if (!fs.existsSync(officialPdfPath)) {
      const fallbacks = [
        path.join(__dirname, '../../../public_html/official_form.pdf'),
        path.join(__dirname, '../../public/official_form.pdf'),
        path.join(__dirname, '../../official_form.pdf'),
        path.join(process.cwd(), 'public/official_form.pdf'),
        path.join(process.cwd(), 'official_form.pdf')
      ];
      for (const fallback of fallbacks) {
        if (fs.existsSync(fallback)) {
          officialPdfPath = fallback;
          break;
        }
      }
    }

    if (!fs.existsSync(officialPdfPath)) {
      throw new Error("Base PDF not found at any known locations.");
    }

    const officialPdfBytes = fs.readFileSync(officialPdfPath);
    const pdfDoc = await PDFDocument.load(officialPdfBytes);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const dingbats = await pdfDoc.embedFont(StandardFonts.ZapfDingbats);

    // If template exists, populate fields over the existing pages
    if (activeTemplate) {
      const fields = safeJsonParse(activeTemplate.fields) || [];
      const pages = pdfDoc.getPages();

      for (const field of fields) {
        const pageIndex = (field.page || 1) - 1;
        if (pageIndex < 0 || pageIndex >= pages.length) continue;
        
        const page = pages[pageIndex];
        const { height } = page.getSize();
        // pdf-lib's y coordinate is from bottom. The frontend will likely send y from top.
        // We will assume frontend sends y from top, so we do height - y.
        const yPos = height - field.y; 

        if (['selfie', 'signature', 'esign', 'panImage', 'aadhaarImage'].includes(field.variable)) {
          let imgRelPath = null;
          if (field.variable === 'selfie') {
            imgRelPath = parsedSelfieDetails.path || parsedSelfieDetails.preview || applicationData.selfie?.preview;
          } else if (field.variable === 'signature') {
            imgRelPath = parsedSignature.path || parsedSignature.preview;
          } else if (field.variable === 'esign') {
            const esignDoc = parsedDocuments.find(d => d.type === 'ESIGN');
            if (esignDoc) imgRelPath = esignDoc.path;
          } else if (field.variable === 'panImage') {
            imgRelPath = parsedPanUpload?.path || parsedPanUpload?.filePreview || parsedPanUpload?.preview;
            if (!imgRelPath) {
              const panDoc = parsedDocuments.find(d => d.path && /digilocker_pan|_pan_issued|(^|[\/_])pan([\/_]|\.)/i.test(d.path));
              if (panDoc) imgRelPath = panDoc.path;
            }
          } else if (field.variable === 'aadhaarImage') {
            const aadhaarDoc = parsedDocuments.find(d => d.path && /digilocker_aadhaar|_aadhaar_issued|aadhaar|aadhar|uid/i.test(d.path));
            if (aadhaarDoc) imgRelPath = aadhaarDoc.path;
          }

          if (imgRelPath) {
            try {
              const cleanPath = imgRelPath.startsWith('/') ? imgRelPath.substring(1) : imgRelPath;
              const imgPath = path.join(__dirname, '../../', cleanPath);
              if (fs.existsSync(imgPath)) {
                const imgBytes = fs.readFileSync(imgPath);
                const w = field.width || 100;
                const h = field.height || 100;
                const lowerPath = imgPath.toLowerCase();

                if (lowerPath.endsWith('.pdf')) {
                  const [embeddedPage] = await pdfDoc.embedPdf(imgBytes);
                  page.drawPage(embeddedPage, { x: field.x, y: yPos - h, width: w, height: h });
                } else if (lowerPath.endsWith('.png')) {
                  const image = await pdfDoc.embedPng(imgBytes);
                  page.drawImage(image, { x: field.x, y: yPos - h, width: w, height: h });
                } else {
                  const image = await pdfDoc.embedJpg(imgBytes);
                  page.drawImage(image, { x: field.x, y: yPos - h, width: w, height: h });
                }
              }
            } catch(e) { console.error("[PDF Gen] Img embed fail:", e.message); }
          }
        } else if (field.type === 'checkbox') {
          const val = getVariableValue(field.variable, applicationData);
          const isMatch = field.matchValue 
            ? String(val).toLowerCase() === String(field.matchValue).toLowerCase()
            : !!val; // if no match value, act as boolean flag
            
          if (isMatch) {
            page.drawText('4', { // '4' in ZapfDingbats is a check mark
              x: field.x,
              y: yPos - (field.fontSize || 14),
              size: (field.fontSize || 14) + 4,
              font: dingbats,
              color: rgb(0, 0, 0)
            });
          }
        } else {
          // Handle Text
          const val = getVariableValue(field.variable, applicationData);
          if (val) {
            page.drawText(String(val), {
              x: field.x,
              y: yPos - (field.fontSize || 12),
              size: field.fontSize || 12,
              font: font,
              color: rgb(0, 0, 0),
              maxWidth: field.width || undefined,
              lineHeight: (field.fontSize || 12) * 1.2
            });
          }
        }
      }
    } else {
      // FALLBACK TO ANNEXURE PAGE (OLD BEHAVIOR)
      const page = pdfDoc.addPage([595.28, 841.89]);
      const { width, height } = page.getSize();
      page.drawText('KYC SUMMARY ANNEXURE', { x: 50, y: height - 50, size: 18, font: boldFont, color: rgb(0, 0, 0) });

      let currentY = height - 90;
      const lineHeight = 18;

      const drawSection = (title) => {
        currentY -= 10;
        page.drawRectangle({ x: 45, y: currentY - 5, width: width - 90, height: 20, color: rgb(0.9, 0.9, 0.95) });
        page.drawText(title.toUpperCase(), { x: 50, y: currentY, size: 10, font: boldFont, color: rgb(0.1, 0.1, 0.4) });
        currentY -= 25;
      };

      const drawField = (label, value) => {
        const displayValue = String(value || 'Not Provided');
        page.drawText(`${label}:`, { x: 50, y: currentY, size: 9, font: boldFont });
        if (displayValue.length > 60) {
          page.drawText(displayValue.substring(0, 60), { x: 180, y: currentY, size: 9, font: font });
          currentY -= lineHeight - 4;
          page.drawText(displayValue.substring(60), { x: 180, y: currentY, size: 9, font: font });
        } else {
          page.drawText(displayValue, { x: 180, y: currentY, size: 9, font: font });
        }
        currentY -= lineHeight;
      };

      drawSection('Application Information');
      drawField('Application ID', applicationData.applicationId);
      drawField('Status', applicationData.status);

      drawSection('Personal & Identity Details');
      drawField('Full Name', getVariableValue('fullName', applicationData));
      drawField('PAN Number', getVariableValue('pan', applicationData));
      drawField('Aadhaar Number', getVariableValue('aadhaar', applicationData));
      drawField('Phone', getVariableValue('phone', applicationData));

      currentY -= 20;

      // Embed Selfie and Signature on Annexure
      const selfieRel = parsedSelfieDetails?.path || parsedSelfieDetails?.preview || applicationData?.selfie?.preview;
      if (selfieRel) {
        try {
          const clean = selfieRel.startsWith('/') ? selfieRel.substring(1) : selfieRel;
          const p = path.join(__dirname, '../../', clean);
          if (fs.existsSync(p)) {
            const b = fs.readFileSync(p);
            const img = p.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(b) : await pdfDoc.embedJpg(b);
            page.drawImage(img, { x: 50, y: currentY - 140, width: 120, height: 120 });
            page.drawText('CUSTOMER SELFIE', { x: 50, y: currentY - 155, size: 8, font: boldFont });
          }
        } catch (e) { console.error(e); }
      }

      const sigRel = parsedSignature?.path || parsedSignature?.preview;
      if (sigRel) {
        try {
          const clean = sigRel.startsWith('/') ? sigRel.substring(1) : sigRel;
          const p = path.join(__dirname, '../../', clean);
          if (fs.existsSync(p)) {
            const b = fs.readFileSync(p);
            const img = p.toLowerCase().endsWith('.png') ? await pdfDoc.embedPng(b) : await pdfDoc.embedJpg(b);
            page.drawImage(img, { x: 350, y: currentY - 140, width: 120, height: 60 });
            page.drawText('CUSTOMER SIGNATURE', { x: 350, y: currentY - 155, size: 8, font: boldFont });
          }
        } catch (e) { console.error(e); }
      }
    }

    // 5. Append Uploaded and Extracted Documents (ALWAYS RUNS)
    const appendDocument = async (docPathRel, title) => {
      if (!docPathRel) return;
      try {
        const cleanPath = docPathRel.startsWith('/') ? docPathRel.substring(1) : docPathRel;
        const docPath = path.join(__dirname, '../../', cleanPath);
        if (!fs.existsSync(docPath)) return;

        const bytes = fs.readFileSync(docPath);
        const lowerPath = docPath.toLowerCase();

        if (lowerPath.endsWith('.pdf')) {
          const externalPdf = await PDFDocument.load(bytes);
          const copied = await pdfDoc.copyPages(externalPdf, externalPdf.getPageIndices());
          copied.forEach((p) => pdfDoc.addPage(p));
        } else if (lowerPath.endsWith('.jpg') || lowerPath.endsWith('.jpeg') || lowerPath.endsWith('.png')) {
          const img = lowerPath.endsWith('.png') ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);
          const imgPage = pdfDoc.addPage([595.28, 841.89]); // A4
          const { width: pWidth, height: pHeight } = imgPage.getSize();
          
          if (title) {
            imgPage.drawText(title.toUpperCase(), { x: 50, y: pHeight - 50, size: 14, font: boldFont, color: rgb(0,0,0) });
          }

          const imgDims = img.scaleToFit(pWidth - 100, pHeight - 100);
          imgPage.drawImage(img, {
            x: pWidth / 2 - imgDims.width / 2,
            y: pHeight / 2 - imgDims.height / 2,
            width: imgDims.width,
            height: imgDims.height,
          });
        }
      } catch (e) {
        console.error(`[PDF Gen] Failed to append document ${docPathRel}:`, e.message);
      }
    };

    const docsToAppend = [];
    
    parsedDocuments.forEach(doc => {
      if (doc?.path && doc.type !== 'ESIGN' && doc.type !== 'DIGILOCKER_DOCUMENT') {
        docsToAppend.push({ path: doc.path, title: doc.type || 'Document' });
      }
    });
    
    const panPath = parsedPanUpload?.path || parsedPanUpload?.filePreview || parsedPanUpload?.preview;
    if (panPath) docsToAppend.push({ path: panPath, title: 'PAN Upload' });
    
    const finPath = parsedFinancialProof?.path || parsedFinancialProof?.filePreview || parsedFinancialProof?.preview;
    if (finPath) docsToAppend.push({ path: finPath, title: 'Financial Proof' });
    
    const bankPath = parsedBankDetails?.proofPath || parsedBankDetails?.proofPreview || parsedBankDetails?.proof;
    if (bankPath) docsToAppend.push({ path: bankPath, title: 'Bank Proof' });
    
    const pepPath = parsedPersonalDetails?.pepProof || parsedPersonalDetails?.pepProofPreview;
    if (pepPath) docsToAppend.push({ path: pepPath, title: 'PEP Proof' });
    
    if (parsedNomineeDetails?.nominees) {
      parsedNomineeDetails.nominees.forEach((nom, idx) => {
        const nomPath = nom.proofPath || nom.proofPreview || nom.preview;
        if (nomPath) docsToAppend.push({ path: nomPath, title: `Nominee ${idx + 1} Proof` });
        
        const guardPath = nom.guardianProofPath || nom.guardianProofPreview || nom.guardianPreview;
        if (guardPath) docsToAppend.push({ path: guardPath, title: `Nominee ${idx + 1} Guardian Proof` });
      });
    }

    const seenPaths = new Set();
    for (const doc of docsToAppend) {
      if (seenPaths.has(doc.path)) continue;
      seenPaths.add(doc.path);
      await appendDocument(doc.path, doc.title);
    }

    console.log(`[PDF Gen] Successfully generated PDF`);
    return await pdfDoc.saveAsBase64();
  } catch (error) {
    console.error("[PDF Gen] Fatal error:", error);
    throw error;
  }
}

module.exports = { generateKycPdf };

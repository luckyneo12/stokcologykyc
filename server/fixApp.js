const path = require('path');
const fs = require('fs');

async function fixApp() {
  const { PrismaClient } = require('@prisma/client');
  const prisma = new PrismaClient();
  const { createDigilockerAadhaarPdf, createDigilockerPanPdf } = require('./src/utils/pdfGenerator');
  const cloudinary = require("cloudinary").v2;

  require('dotenv').config();

  const uploadBufferToCloudinary = (buffer, filename, format = undefined) => {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        { 
          folder: "kyc_uploads", 
          public_id: filename, 
          resource_type: "auto",
          ...(format && { format })
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      uploadStream.end(buffer);
    });
  };

  const app = await prisma.kycApplication.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (!app) return;

  const identityDetails = typeof app.identityDetails === 'string' ? JSON.parse(app.identityDetails) : app.identityDetails || {};
  const personalDetails = typeof app.personalDetails === 'string' ? JSON.parse(app.personalDetails) : app.personalDetails || {};
  const address = typeof app.address === 'string' ? JSON.parse(app.address) : app.address || {};
  let docs = typeof app.documents === 'string' ? JSON.parse(app.documents) : app.documents || [];

  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

  let modified = false;
  
  // Clean up mistakenly marked generated ones
  docs.forEach(d => {
    if (d.path && d.path.includes('issued')) {
      if (d.generated) {
        d.generated = false;
        modified = true;
      }
    }
  });

  // Generate Aadhaar if missing valid generated one
  if (identityDetails.aadhaar && !docs.some(d => d.type === 'AADHAAR' && d.generated && !d.path.includes('issued'))) {
    console.log("Generating Aadhaar PDF...");
    const filename = `digilocker_aadhaar_${app.applicationId}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, filename);
    const photoPath = docs.find(d => d.type === 'PHOTO')?.path;
    
    await createDigilockerAadhaarPdf({
      filePath,
      identityDetails,
      personalDetails,
      address,
      photoPath
    });

    const fileBuffer = fs.readFileSync(filePath);
    const publicId = filename.replace('.pdf', '');
    const cloudinaryResult = await uploadBufferToCloudinary(fileBuffer, publicId, 'pdf');
    try { fs.unlinkSync(filePath); } catch (e) {}

    docs.push({
      path: cloudinaryResult.secure_url,
      type: "AADHAAR",
      label: "DigiLocker AADHAAR Verification PDF",
      generated: true
    });
    modified = true;
  }

  // Generate PAN if missing
  if (identityDetails.pan && !docs.some(d => d.type === 'PAN' && d.generated && !d.path.includes('issued'))) {
    console.log("Generating PAN PDF...");
    const filename = `digilocker_pan_${app.applicationId}_${Date.now()}.pdf`;
    const filePath = path.join(uploadsDir, filename);
    
    await createDigilockerPanPdf({
      filePath,
      identityDetails,
      personalDetails
    });

    const fileBuffer = fs.readFileSync(filePath);
    const publicId = filename.replace('.pdf', '');
    const cloudinaryResult = await uploadBufferToCloudinary(fileBuffer, publicId, 'pdf');
    try { fs.unlinkSync(filePath); } catch (e) {}

    docs.push({
      path: cloudinaryResult.secure_url,
      type: "PAN",
      label: "DigiLocker PAN Verification PDF",
      generated: true
    });
    modified = true;
  }

  if (modified) {
    await prisma.kycApplication.update({
      where: { id: app.id },
      data: { documents: JSON.stringify(docs) }
    });
    console.log("Fixed user's application documents!");
  } else {
    console.log("PDFs already generated.");
  }
  process.exit(0);
}

fixApp().catch(console.error);

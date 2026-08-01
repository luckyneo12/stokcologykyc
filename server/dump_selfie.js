const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const latestApp = await prisma.kycApplication.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log("Selfie Details:", latestApp.selfieDetails);
  console.log("Selfie:", latestApp.selfie);
  console.log("OCR Data Digio SELFIE:", JSON.parse(latestApp.ocrData || '{}')?.digio?.SELFIE);
  console.log("OCR Data Digio LIVENESS:", JSON.parse(latestApp.ocrData || '{}')?.digio?.LIVENESS);
  
  // also dump documents to see if it's there
  console.log("Documents:", latestApp.documents);
})();

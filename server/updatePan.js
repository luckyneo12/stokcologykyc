const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function update() {
  const targetId = "TST999";
  
  const app = await prisma.kycApplication.findFirst({
    where: { clientCode: targetId }
  });

  if (app) {
    let identityDetails = {};
    try { identityDetails = JSON.parse(app.identityDetails || "{}"); } catch(e){}
    identityDetails.pan = "ZZZPK9999Z";
    identityDetails.panNumber = "ZZZPK9999Z";
    
    // Also randomize Aadhar to avoid conflict
    identityDetails.aadhar = "xxxxxxxx9999";
    identityDetails.aadhaar = "xxxxxxxx9999";
    
    let personalDetails = {};
    try { personalDetails = JSON.parse(app.personalDetails || "{}"); } catch(e){}
    personalDetails.email = "test999@example.com";
    personalDetails.mobile = "9999999999";
    personalDetails.phone = "9999999999";

    await prisma.kycApplication.update({
      where: { id: app.id },
      data: {
        identityDetails: JSON.stringify(identityDetails),
        personalDetails: JSON.stringify(personalDetails)
      }
    });
    console.log("UPDATED PAN, AADHAR AND EMAIL/MOBILE SUCCESSFULLY");
  } else {
    console.log("NOT FOUND");
  }
}

update().catch(console.error).finally(() => prisma.$disconnect());

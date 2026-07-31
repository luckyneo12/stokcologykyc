const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixDummy() {
  const dummyApp = await prisma.kycApplication.findFirst({
    where: { clientCode: "DUMMY999" }
  });

  if (dummyApp) {
    let address = {};
    try { address = JSON.parse(dummyApp.address || "{}"); } catch(e){}
    address.addressProof = "01"; // 01 means UID Aadhar Card
    
    let bankDetails = {};
    try { bankDetails = JSON.parse(dummyApp.bankDetails || "{}"); } catch(e){}
    bankDetails.state = "MH"; // Max 5 chars
    bankDetails.address1 = "123 Bank Street"; // Cannot be empty
    bankDetails.address2 = "Andheri West";
    bankDetails.address3 = "Mumbai";

    await prisma.kycApplication.update({
      where: { id: dummyApp.id },
      data: {
        address: JSON.stringify(address),
        bankDetails: JSON.stringify(bankDetails)
      }
    });

    console.log("FIXED DUMMY RECORD VALIDATION ERRORS");
  } else {
    console.log("DUMMY NOT FOUND");
  }
}

fixDummy().catch(console.error).finally(() => prisma.$disconnect());

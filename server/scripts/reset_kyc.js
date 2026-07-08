const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const app = await prisma.kycApplication.findUnique({
    where: { applicationId: 'KYCMR658N5R3D0F' }
  });
  if (app) {
    await prisma.kycApplication.update({
      where: { applicationId: 'KYCMR658N5R3D0F' },
      data: { status: 'under_review' }
    });
    console.log("Updated app status to under_review");

    // Clear user eStamp
    await prisma.user.update({
      where: { id: app.userId },
      data: { eStamp: null }
    });
    console.log("Cleared user eStamp");

    // Reset eStamp record
    await prisma.eStamp.updateMany({
      where: { assignedTo: app.userId },
      data: { status: 'available', assignedTo: null }
    });
    console.log("Reset EStamp record back to available");
  }
}

main().then(() => process.exit(0));

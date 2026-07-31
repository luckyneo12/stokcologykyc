const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function update() {
  const targetId = "JRR842";
  const newId = "TST999";
  
  const app = await prisma.kycApplication.findFirst({
    where: {
      OR: [
        { clientCode: targetId },
        { applicationId: targetId }
      ]
    }
  });

  if (app) {
    await prisma.kycApplication.update({
      where: { id: app.id },
      data: {
        clientCode: newId,
        applicationId: newId
      }
    });
    console.log("UPDATED SUCCESSFULLY TO " + newId);
  } else {
    console.log("NOT FOUND");
  }
}

update().catch(console.error).finally(() => prisma.$disconnect());

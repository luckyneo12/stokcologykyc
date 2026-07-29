const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.pdfTemplate.updateMany({ data: { isActive: false } });
  
  await prisma.pdfTemplate.update({
    where: { id: 1 },
    data: { isActive: true }
  });
  console.log("Successfully restored template ID 1!");
}
run().catch(console.error).finally(()=>prisma.$disconnect());

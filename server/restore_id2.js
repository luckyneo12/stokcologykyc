const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.pdfTemplate.update({
  where: { id: 2 },
  data: { 
    isActive: true,
    basePdfUrl: '/uploads/1785128455571-master.pdf'
  }
}).then(async () => {
  await prisma.pdfTemplate.updateMany({
    where: { id: { not: 2 } },
    data: { isActive: false }
  });
  console.log("Restored ID 2 with 1785128455571-master.pdf");
}).finally(() => prisma.$disconnect());

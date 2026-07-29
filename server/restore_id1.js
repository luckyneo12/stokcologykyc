const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.pdfTemplate.update({
  where: { id: 1 },
  data: { 
    isActive: true,
    name: 'My Mapped Template',
    basePdfUrl: '/official_form.pdf'
  }
}).then(async () => {
  await prisma.pdfTemplate.updateMany({
    where: { id: { not: 1 } },
    data: { isActive: false }
  });
  console.log("Restored ID 1 and renamed it");
}).finally(() => prisma.$disconnect());

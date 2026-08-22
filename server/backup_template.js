const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function main() {
  const activeTemplate = await prisma.pdfTemplate.findFirst({
    where: { isActive: true }
  });
  if (activeTemplate) {
    fs.writeFileSync('template_backup.json', JSON.stringify(activeTemplate, null, 2));
    console.log('Template backed up to template_backup.json');
  } else {
    console.log('No active template found.');
  }
}

main()
  .catch(console.error)
  .finally(() => {
    prisma.$disconnect();
  });

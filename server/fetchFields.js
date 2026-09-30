const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  if (template) {
    const fields = JSON.parse(template.fields);
    console.log("Fields count:", fields.length);
    console.log("Saving fields to fields.json");
    require('fs').writeFileSync('fields.json', JSON.stringify(fields, null, 2));
  } else {
    console.log("No active template found");
  }
  await prisma.$disconnect();
}
main();

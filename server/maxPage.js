const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const template = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  if (template) {
    const fields = JSON.parse(template.fields);
    console.log(Math.max(...fields.variables.map(f => f.page || 0)));
  }
  await prisma.$disconnect();
}
main();

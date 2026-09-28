const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  if (!template) return;
  const fields = JSON.parse(template.fields);
  const vars = fields.variables || fields;
  vars.forEach(f => {
    if (f.variable && (f.variable.includes('Dis') || f.variable.includes('Settlement') || f.variable.includes('Pledge'))) {
      console.log(f.variable, 'width:', f.width, 'height:', f.height);
    }
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());

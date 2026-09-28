const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  if (!template) return;
  const fields = JSON.parse(template.fields);
  const vars = fields.variables || fields;
  
  vars.forEach(f => {
    if (f.variable && (f.variable.includes('Settlement') || f.variable.includes('Dis') || f.variable.includes('Pledge') || f.variable.includes('dis'))) {
      console.log(f.variable, 'matchValue:', f.matchValue, 'type:', f.type, 'x:', f.x, 'y:', f.y, 'page:', f.page);
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

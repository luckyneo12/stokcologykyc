const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  if (!template) return console.log('no active template');
  
  const fields = JSON.parse(template.fields);
  const vars = fields.variables || fields;
  
  console.log("Checking template mappings for 'pledge', 'dis', 'settlement'...");
  vars.forEach(f => {
    if (f.variable) {
      const v = f.variable.toLowerCase();
      if (v.includes('pledge') || v.includes('dis') || v.includes('settlement')) {
        console.log(`- PDF Builder mapped variable: ${f.variable} (type: ${f.type})`);
      }
    }
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());

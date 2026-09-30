const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  if (template) {
    const fields = JSON.parse(template.fields);
    let updated = 0;
    
    fields.variables.forEach(f => {
      if (f.page === 54 && f.variable === 'esign') {
        f.variable = 'esignDdpi';
        updated++;
      }
    });

    if (updated > 0) {
      await prisma.pdfTemplate.update({
        where: { id: template.id },
        data: { fields: JSON.stringify(fields) }
      });
      console.log(`Successfully updated ${updated} esign fields to esignDdpi on page 54!`);
    } else {
      console.log("No esign fields found on page 54.");
    }
  } else {
    console.log("No active template found");
  }
  await prisma.$disconnect();
}
main();

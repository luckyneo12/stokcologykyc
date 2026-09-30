const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const template = await prisma.pdfTemplate.findFirst({ where: { isActive: true } });
  if (template) {
    const fields = JSON.parse(template.fields);
    
    // Check if isPhotoChecked already exists
    const exists = fields.variables.find(f => f.variable === 'isPhotoChecked' && f.page === 8);
    if (exists) {
      console.log("isPhotoChecked already exists!");
    } else {
      fields.variables.push({
        "id": "1785502289394v63s_photo",
        "variable": "isPhotoChecked",
        "type": "checkbox",
        "matchValue": "",
        "page": 8,
        "x": 544,
        "y": 143,
        "width": 20,
        "height": 20,
        "fontSize": 16
      });
      
      await prisma.pdfTemplate.update({
        where: { id: template.id },
        data: { fields: JSON.stringify(fields) }
      });
      console.log("Successfully added isPhotoChecked on page 8!");
    }
  } else {
    console.log("No active template found");
  }
  await prisma.$disconnect();
}
main();

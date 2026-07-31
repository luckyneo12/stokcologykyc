const prisma = require("./src/config/db");

async function main() {
  const t = await prisma.pdfTemplate.findFirst({
    where: { isActive: true },
  });
  
  if (!t) {
    console.log("No active template");
    return;
  }
  
  const parsed = typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields;
  const fields = Array.isArray(parsed) ? parsed : (parsed.variables || []);
  
  // Find all fields on page 1 that are checkboxes
  const page1Checks = fields.filter(f => f.page === 1 && f.type === 'checkbox');
  
  console.log(JSON.stringify(page1Checks.map(f => f.variable), null, 2));
}

main().finally(() => prisma.$disconnect());

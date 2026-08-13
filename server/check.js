const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const prisma = new PrismaClient();

async function checkDb() {
  const app = await prisma.kycApplication.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  
  if (!app) return;
  fs.writeFileSync('scratch_db.json', JSON.stringify({id: app.id, documents: app.documents}, null, 2));
  
  let docs = typeof app.documents === 'string' ? JSON.parse(app.documents) : app.documents;
  let modified = false;
  docs.forEach(d => {
    // If it's a PDF but not marked generated, mark it generated so it shows in the maker checker
    if (d.path && typeof d.path === 'string' && d.path.endsWith('.pdf')) {
      if (!d.generated) {
        d.generated = true;
        modified = true;
      }
    }
  });
  
  if (modified) {
    await prisma.kycApplication.update({
      where: { id: app.id },
      data: { documents: JSON.stringify(docs) }
    });
    console.log("Fixed DB documents");
  } else {
    console.log("No modifications needed");
  }

  console.log("Done");
  await prisma.$disconnect();
  process.exit(0);
}
checkDb();

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  try {
    // Find the currently active template or the "Default Template" they are likely saving to
    const template = await prisma.pdfTemplate.findFirst({
      where: {
        OR: [
          { isActive: true },
          { name: "Default Template" }
        ]
      },
      orderBy: { updatedAt: 'desc' }
    });

    if (template) {
      const backupData = {
        timestamp: new Date().toISOString(),
        templateId: template.id,
        templateName: template.name,
        basePdfUrl: template.basePdfUrl,
        fields: JSON.parse(template.fields), // Parse to ensure it's valid JSON
        pages: template.pages ? JSON.parse(template.pages) : []
      };

      const backupFilePath = 'template_backup_before_compile.json';
      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));
      console.log(`Backup successfully created at ${backupFilePath}`);
      console.log(`Backed up ${backupData.fields.length || (backupData.fields.variables && backupData.fields.variables.length)} fields.`);
    } else {
      console.log("No active template found to backup.");
    }
  } catch (error) {
    console.error("Backup failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

run();

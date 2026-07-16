const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("Starting HTML to DB Import...");
  const kycPagesDir = path.resolve(__dirname, '../kyc_pages');
  const files = fs.readdirSync(kycPagesDir).filter(f => f.endsWith('.html'));

  const getPageNum = (filename) => {
    if (filename === 'first_page.html') return 1;
    if (filename === 'second_page.html') return 2;
    if (filename === 'sixth_page.html') return 6;
    const match = filename.match(/page_(\d+)\.html/);
    return match ? parseInt(match[1]) : 0;
  };

  const fields = [];

  for (const file of files) {
    const pageNum = getPageNum(file);
    if (pageNum === 0) continue;

    const content = fs.readFileSync(path.join(kycPagesDir, file), 'utf8');
    
    // Regex to match input tags
    const inputRegex = /<input[^>]+>/g;
    let match;
    
    while ((match = inputRegex.exec(content)) !== null) {
      const tag = match[0];
      
      const nameMatch = tag.match(/name="([^"]+)"/);
      const leftMatch = tag.match(/left:\s*([0-9.]+)pt/);
      const topMatch = tag.match(/top:\s*([0-9.]+)pt/);
      const widthMatch = tag.match(/width:\s*([0-9.]+)pt/);
      const heightMatch = tag.match(/height:\s*([0-9.]+)pt/);
      
      if (nameMatch && leftMatch && topMatch) {
        let variable = nameMatch[1];
        
        // Map common intelligent namer variables to expected pdfGenerator.js variables
        if (variable.startsWith('client_name')) variable = 'fullName';
        if (variable.startsWith('dob_or_date')) variable = 'dob';
        if (variable.startsWith('pan_number')) variable = 'pan';
        if (variable.startsWith('aadhaar_number')) variable = 'aadhaar';
        if (variable.startsWith('email_address')) variable = 'email';
        if (variable.startsWith('phone_number')) variable = 'phone';
        if (variable.startsWith('pincode')) variable = 'pincode';
        if (variable.startsWith('address_or_name')) variable = 'fullAddress';

        fields.push({
          id: `field_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: 'text',
          x: parseFloat(leftMatch[1]),
          y: parseFloat(topMatch[1]),
          width: widthMatch ? parseFloat(widthMatch[1]) : 100,
          height: heightMatch ? parseFloat(heightMatch[1]) : 15,
          page: pageNum,
          variable: variable,
          fontSize: 10
        });
      }
    }
  }

  console.log(`Extracted ${fields.length} fields from HTML files.`);

  // Update or Create Template in DB
  let template = await prisma.pdfTemplate.findFirst({
    where: { name: "Master Auto-Imported Template" }
  });

  // Deactivate others
  await prisma.pdfTemplate.updateMany({
    data: { isActive: false }
  });

  if (template) {
    template = await prisma.pdfTemplate.update({
      where: { id: template.id },
      data: {
        fields: JSON.stringify(fields),
        isActive: true,
        basePdfUrl: 'public/official_form.pdf'
      }
    });
    console.log("Updated existing Master Template.");
  } else {
    template = await prisma.pdfTemplate.create({
      data: {
        name: "Master Auto-Imported Template",
        isActive: true,
        basePdfUrl: 'public/official_form.pdf',
        fields: JSON.stringify(fields)
      }
    });
    console.log("Created new Master Template.");
  }

  console.log("Import Complete!");
  await prisma.$disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

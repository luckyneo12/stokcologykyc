const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.pdfTemplate.findMany({select: {id:true, name:true, isActive:true, basePdfUrl:true, fields:true}})
  .then((templates) => {
    templates.forEach(t => {
      console.log(`ID: ${t.id}, Name: ${t.name}, URL: ${t.basePdfUrl}`);
      const f = JSON.parse(t.fields);
      const vars = f.variables || f;
      console.log(`  - Variables count: ${vars.length}`);
      const hasCheckbox = vars.some(v => v.type === 'checkbox');
      console.log(`  - Has checkboxes: ${hasCheckbox}`);
    });
  })
  .finally(()=>prisma.$disconnect());

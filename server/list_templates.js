const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.pdfTemplate.findMany({select: {id:true, name:true, isActive:true, basePdfUrl:true}})
  .then(console.log)
  .finally(()=>prisma.$disconnect());

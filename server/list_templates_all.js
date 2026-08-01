const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.pdfTemplate.findMany({select: {id:true, name:true, isActive:true, updatedAt:true}})
.then(t => console.log(JSON.stringify(t, null, 2)))
.catch(console.error)
.finally(()=>prisma.$disconnect());

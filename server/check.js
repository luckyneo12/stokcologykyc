const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const latest = await prisma.kycApplication.findMany({
    orderBy: { createdAt: 'desc' },
    take: 1
  });
  console.log(JSON.stringify(latest, null, 2));
  await prisma.$disconnect();
}

check();

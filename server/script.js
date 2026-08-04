const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const user = await prisma.user.findUnique({where: {id: 43}});
  if(!user) return console.log('user not found');
  const boid = await prisma.boid.findFirst({where: {status: 'available'}});
  if(!boid) return console.log('no available boid');
  await prisma.$transaction([
    prisma.boid.update({where: {id: boid.id}, data: {status: 'assigned', assignedTo: user.id}}),
    prisma.user.update({where: {id: user.id}, data: {boid: boid.boidNumber}})
  ]);
  console.log('assigned boid', boid.boidNumber, 'to user', user.id);
}
run();

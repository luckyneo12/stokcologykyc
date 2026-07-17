const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Adding clientCode column to KycApplication...");
    await prisma.$executeRawUnsafe('ALTER TABLE `KycApplication` ADD COLUMN `clientCode` VARCHAR(191) NULL');
    console.log("Column added successfully!");
  } catch (e) {
    if (e.message.includes("Duplicate column name")) {
      console.log("Column already exists. All good!");
    } else {
      console.error("Error:", e);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();

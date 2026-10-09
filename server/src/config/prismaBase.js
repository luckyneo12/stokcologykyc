const { PrismaClient } = require("@prisma/client");

// The single database connection. Application code uses config/db.js (which hides applications
// in the Trash); only the Trash module uses this unfiltered client directly.
const prismaBase = new PrismaClient({
  log: ["error", "warn"],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});

module.exports = prismaBase;

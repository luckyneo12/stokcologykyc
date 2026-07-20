const prisma = require("./src/config/db");

async function main() {
  const apps = await prisma.kycApplication.findMany({
    where: { clientCode: null, identityDetails: { not: null } }
  });

  console.log(`Found ${apps.length} applications to backfill`);

  let count = 0;
  for (const app of apps) {
    let idDetails;
    try {
      idDetails = JSON.parse(app.identityDetails);
    } catch (e) {
      continue;
    }
    const panValue = idDetails?.pan || idDetails?.panNumber;
    if (panValue && typeof panValue === 'string' && panValue.length >= 3) {
      const prefix = panValue.substring(0, 3).toUpperCase();
      let uniqueClientCode = null;
      let attempts = 0;
      while (!uniqueClientCode && attempts < 10) {
        const randomDigits = Math.floor(100 + Math.random() * 900).toString();
        const candidate = prefix + randomDigits;
        const existing = await prisma.kycApplication.findFirst({
          where: { clientCode: candidate }
        });
        if (!existing) {
          uniqueClientCode = candidate;
        }
        attempts++;
      }
      if (uniqueClientCode) {
        await prisma.kycApplication.update({
          where: { id: app.id },
          data: { clientCode: uniqueClientCode }
        });
        console.log(`Backfilled ${app.applicationId} with ${uniqueClientCode}`);
        count++;
      }
    }
  }
  console.log(`Successfully backfilled ${count} applications.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

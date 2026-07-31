const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDummy() {
  let user = await prisma.user.findFirst();
  if (!user) {
    user = await prisma.user.create({
      data: {
        phone: "8888888888",
        email: "dummyuser@example.com",
        role: "user"
      }
    });
  }

  const dummyApp = await prisma.kycApplication.create({
    data: {
      userId: user.id,
      applicationId: "DUMMY-" + Math.floor(Math.random() * 10000),
      clientCode: "DUMMY999",
      status: "verified", // Makes it show up in maker-checker as ready
      currentStep: 14,
      personalDetails: JSON.stringify({
        fullName: "Dummy Applicant",
        dob: "1990-01-01",
        fatherName: "Dummy Father",
        motherName: "Dummy Mother",
        gender: "M",
        maritalStatus: "M",
        email: "dummy@example.com",
        mobile: "8888888888",
        annualIncome: "01",
        occupation: "01",
        politicallyExposed: "No"
      }),
      identityDetails: JSON.stringify({
        pan: "DUMMY1234D",
        aadhar: "xxxxxxxx1111",
        dob: "1990-01-01"
      }),
      address: JSON.stringify({
        line1: "123 Dummy Street",
        city: "Mumbai",
        pincode: "400001",
        district: "Mumbai",
        state: "Maharashtra",
        country: "India",
        addressProof: "Aadhar"
      }),
      bankDetails: JSON.stringify({
        accountNumber: "1234567890",
        accountType: "Savings",
        ifsc: "SBIN0000001",
        micr: "400002001",
        accountHolderName: "Dummy Applicant",
        bankName: "State Bank of India",
        city: "Mumbai",
        state: "Maharashtra",
        country: "India"
      }),
      nomineeDetails: JSON.stringify([{
        name: "Dummy Nominee",
        relation: "Spouse",
        dob: "1995-01-01",
        sharePercentage: 100
      }]),
      segments: JSON.stringify({
        equity: true,
        derivatives: false
      })
    }
  });

  console.log("CREATED DUMMY APPLICATION:", dummyApp.applicationId);
}

createDummy().catch(console.error).finally(() => prisma.$disconnect());

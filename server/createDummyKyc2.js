const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createDummy2() {
  let user = await prisma.user.findFirst();

  const dummyApp = await prisma.kycApplication.create({
    data: {
      userId: user.id,
      applicationId: "DUMMY-" + Math.floor(Math.random() * 10000),
      clientCode: "DUMMY888",
      status: "verified", 
      currentStep: 14,
      personalDetails: JSON.stringify({
        fullName: "Dummy Applicant Two",
        dob: "1990-01-01",
        fatherName: "Dummy Father",
        motherName: "Dummy Mother",
        gender: "M",
        maritalStatus: "M",
        email: "dummy2@example.com",
        mobile: "8888888888",
        annualIncome: "01",
        occupation: "01",
        politicallyExposed: "No"
      }),
      identityDetails: JSON.stringify({
        pan: "DUMMY5678D",
        aadhar: "xxxxxxxx2222",
        dob: "1990-01-01"
      }),
      address: JSON.stringify({
        line1: "123 Dummy Street",
        city: "Mumbai",
        pincode: "400001",
        district: "Mumbai",
        state: "Maharashtra",
        country: "India",
        addressProof: "01"
      }),
      bankDetails: JSON.stringify({
        accountNumber: "0987654321",
        accountType: "Savings",
        ifsc: "SBIN0000001",
        micr: "400002001",
        accountHolderName: "Dummy Applicant Two",
        bankName: "State Bank of India",
        city: "Mumbai",
        state: "MH",
        country: "India",
        address1: "123 Bank Street"
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

  console.log("CREATED NEW DUMMY:", dummyApp.clientCode);
}

createDummy2().catch(console.error).finally(() => prisma.$disconnect());

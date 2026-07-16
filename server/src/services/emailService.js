const nodemailer = require("nodemailer");

const sendOtpEmail = async (email, otp) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: true, // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    const mailOptions = {
      from: `"Stockology Securities" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Your OTP for KYC Verification",
      text: `Your OTP for KYC verification is ${otp}. It is valid for 5 minutes.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="text-align: center; margin-bottom: 20px;">
            <img src="https://res.cloudinary.com/dogfk2nyq/image/upload/v1777096537/stklogo_ofmddh.png" alt="Stockology logo" style="max-width: 150px; height: auto;" />
          </div>
          <h2 style="color: #333; text-align: center; margin-top: 0;">KYC Verification</h2>
          <p style="font-size: 16px; color: #555;">Hello,</p>
          <p style="font-size: 16px; color: #555;">Your One-Time Password (OTP) for KYC verification is:</p>
          <div style="background-color: #f4f4f4; padding: 15px; border-radius: 5px; text-align: center; margin: 20px 0;">
            <span style="font-size: 24px; font-weight: bold; letter-spacing: 5px; color: #007bff;">${otp}</span>
          </div>
          <p style="font-size: 14px; color: #888;">This OTP is valid for 5 minutes. Please do not share it with anyone.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #aaa; text-align: center;">&copy; 2026 Stockology Securities. All rights reserved.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("CRITICAL ERROR sending email:", error.message);
    console.error(error.stack);
    throw new Error(`Email Service Error: ${error.message}`);
  }
};

/**
 * Sends a rejection notification email to a KYC applicant.
 * Lists the rejected steps and provides a direct link to fix them.
 *
 * @param {string} email - Recipient email
 * @param {string} name - User's display name
 * @param {Array<{stepTitle: string, reason: string}>} rejectedSteps - Steps that were rejected
 * @param {string} modifyLink - Deep link to the KYC portal for modification
 */
const sendRejectionEmail = async (email, name, rejectedSteps, modifyLink) => {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const stepsHtml = rejectedSteps
    .map(
      (s) => `
      <tr>
        <td style="padding: 12px; border: 1px solid #ddd; font-family: serif; color: #000;">${s.stepTitle}</td>
        <td style="padding: 12px; border: 1px solid #ddd; font-family: serif; color: #000;">${s.reason || "Not specified"}</td>
      </tr>`
    )
    .join("");

  const stepsText = rejectedSteps
    .map((s) => `  - ${s.stepTitle}: ${s.reason || "Not specified"}`)
    .join("\n");

  try {
    const mailOptions = {
      from: `"Stockology Securities" <${process.env.SMTP_USER}>`,
      to: email,
      subject: "Action Required — KYC Application Needs Modifications",
      text: `Dear ${name || "User"},\n\nPlease note that the following observations have been raised in your account opening/KYC application.\nKindly re-upload the required documents and update the details accordingly.\n\n${stepsText}\n\nLink - ${modifyLink}\n\nKindly re-login using the provided account opening link and complete the above corrections at the earliest.\n\nFor any assistance, please contact the KYC support team.\nEmail: kyc@stockologysecurities.com\nCall Us: 0731-4258021\n\nRegards,\nCustomer Support Team\nStockology Securities Private Limited`,
      html: `
        <div style="font-family: 'Times New Roman', Times, serif; color: #000; max-width: 800px; margin: 0 auto; padding: 20px;">
          <div style="margin-bottom: 20px;">
            <img src="https://res.cloudinary.com/dogfk2nyq/image/upload/v1777096537/stklogo_ofmddh.png" alt="Stockology logo" style="max-width: 150px; height: auto;" />
          </div>
          
          <p style="font-size: 16px; margin-bottom: 20px;">Dear ${name || "User"},</p>
          
          <p style="font-size: 16px; margin-bottom: 8px;">Please note that the following observations have been raised in your account opening/KYC application.</p>
          <p style="font-size: 16px; margin-bottom: 30px;">Kindly re-upload the required documents and update the details accordingly.</p>
          
          <table style="width: 100%; border-collapse: collapse; border: 1px solid #ddd; margin-bottom: 30px;">
            <thead>
              <tr>
                <th style="padding: 12px; text-align: left; font-size: 16px; border: 1px solid #ddd; font-weight: bold;">Page Name</th>
                <th style="padding: 12px; text-align: left; font-size: 16px; border: 1px solid #ddd; font-weight: bold;">Observation Comment</th>
              </tr>
            </thead>
            <tbody>
              ${stepsHtml}
            </tbody>
          </table>
          
          <p style="font-size: 16px; margin-bottom: 30px;">
            Link - <a href="${modifyLink}" style="color: #0000ee; text-decoration: underline;">${modifyLink}</a>
          </p>
          
          <p style="font-size: 16px; margin-bottom: 40px;">
            Kindly re-login using the provided account opening link and complete the above corrections at the earliest.
          </p>
          
          <p style="font-size: 16px; margin-bottom: 8px;">For any assistance, please contact the KYC support team.</p>
          <p style="font-size: 16px; margin-bottom: 8px;">Email: <a href="mailto:kyc@stockologysecurities.com" style="color: #0000ee; text-decoration: underline;">kyc@stockologysecurities.com</a></p>
          <p style="font-size: 16px; margin-bottom: 40px;">Call Us: 0731-4258021</p>
          
          <p style="font-size: 16px; margin-bottom: 8px;">Regards,</p>
          <p style="font-size: 16px; margin-bottom: 8px;">Customer Support Team</p>
          <p style="font-size: 16px; margin-bottom: 0;">Stockology Securities Private Limited</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("[EmailService] Rejection email sent: %s", info.messageId);
    return true;
  } catch (error) {
    console.error("CRITICAL ERROR sending rejection email:", error.message);
    console.error(error.stack);
    throw new Error(`Email Service Error: ${error.message}`);
  }
};

module.exports = {
  sendOtpEmail,
  sendRejectionEmail,
};

const nodemailer = require("nodemailer");

// Tells the client their modification request was approved or sent back (same SMTP account as the KYC portal).

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

async function sendDecisionMail(request, decision) {
  const to = request.original_profile?.email || request.email;
  if (!to || !process.env.SMTP_HOST) return;
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10),
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  const name = escapeHtml(request.original_profile?.name || request.client_name || "Client");
  const portalUrl = `${(process.env.FRONTEND_URL || "").replace(/\/+$/, "")}/rekyc`;
  const approved = decision === "approved";
  const body = approved
    ? `<p>Your account modification request (client code <b>${escapeHtml(request.client_code)}</b>) has been approved and updated in our records.</p>
       <p>Changes to e-mail and mobile number may take up to 48 hours to reflect.</p>`
    : `<p>Your account modification request (client code <b>${escapeHtml(request.client_code)}</b>) needs a correction:</p>
       <p style="background:#fff4f4;border-left:4px solid #c62828;padding:10px 14px;">${escapeHtml(request.rejection_reason)}</p>
       <p>Please log in at <a href="${escapeHtml(portalUrl)}">${escapeHtml(portalUrl)}</a>, correct the details and sign the form again.</p>`;

  await transporter.sendMail({
    from: `"Stockology Securities" <${process.env.SMTP_USER}>`,
    to,
    subject: approved ? "Your account modification request is approved" : "Action needed on your account modification request",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;border:1px solid #e0e0e0;border-radius:10px;color:#333;">
      <p>Dear ${name},</p>${body}<p>Regards,<br/>Stockology Securities Pvt. Ltd.</p></div>`,
  });
}

module.exports = { sendDecisionMail };

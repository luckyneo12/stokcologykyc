const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const { z } = require("zod");
const emailService = require("../services/emailService");
const smsService = require("../services/smsService");
const crmService = require("../services/crmService");

const JWT_SECRET = process.env.JWT_SECRET || "kyc-secret-key-change-in-production";
const otpStore = new Map();

// Validation schemas
const sendOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number").optional(),
  email: z.string().email("Invalid email").optional(),
  apCode: z.string().optional(),
}).refine(data => data.phone || data.email, "Phone or Email is required");

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number").optional(),
  email: z.string().email("Invalid email").optional(),
  otp: z.string().length(6, "OTP must be 6 digits"),
  apCode: z.string().optional(),
}).refine(data => data.phone || data.email, "Phone or Email is required");

const sendOtp = async (req, res, next) => {
  try {
    const { phone, email } = sendOtpSchema.parse(req.body);
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const key = email || phone;
    
    // Dedup Check BEFORE sending OTP (only for phone numbers)
    if (phone) {
      const user = await prisma.user.findUnique({
        where: { phone },
        include: { kycApplications: { orderBy: { createdAt: 'desc' }, take: 1 } }
      });

      const existingApp = user?.kycApplications?.[0];

      if (existingApp && (existingApp.status === "verified" || existingApp.currentStep >= 17)) {
        console.log(`[Dedup] Blocking OTP for completed user: ${phone} (Step: ${existingApp.currentStep}, Status: ${existingApp.status})`);
        return res.status(400).json({ 
          success: false, 
          error: "You have already completed the application. Your account is either verified or currently under review.",
          code: "ALREADY_EXISTS"
        });
      }

      // Public KYC portal accepts new customers directly.
      // Existing users resume from their saved application step; completed users are blocked above.
    }

    otpStore.set(key, { otp, expiresAt: Date.now() + 300000 });
    
    if (email) {
      console.log(`[OTP] Attempting to send email to ${email}...`);
      await emailService.sendOtpEmail(email, otp);
      console.log(`[OTP] Success: Email sent to ${email}: ${otp}`);
      return res.json({ success: true, message: "OTP sent to your email" });
    } else {
      console.log(`[OTP] Attempting to send SMS to ${phone}...`);
      await smsService.sendMobileOtp(phone, otp);
      console.log(`[OTP] Success: SMS sent to ${phone}: ${otp}`);
      return res.json({ success: true, message: `OTP sent to ${phone}` });
    }
  } catch (error) {
    next(error);
  }
};

const verifyOtp = async (req, res, next) => {
  try {
    const { phone, email, otp, apCode } = verifyOtpSchema.parse(req.body);
    const key = email || phone;
    const stored = otpStore.get(key);

    if (!stored || stored.expiresAt < Date.now()) {
      return res.status(400).json({ error: "OTP expired" });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ error: "Invalid OTP" });
    }

    otpStore.delete(key);

    // If it's a phone verification, we might want to create/find the user
    // If it's email verification in the middle of KYC, we might just return success
    
    if (phone) {
      let isNewUser = false;
      // Find or create user in MySQL
      let user = await prisma.user.findUnique({
        where: { phone }
      });

      if (!user) {
        isNewUser = true;
        user = await prisma.user.create({
          data: { 
            phone, 
            role: "user",
            apCode: apCode || null
          }
        });
        console.log(`[Auth] Created local KYC user: ${phone} (AP: ${apCode || 'None'})`);
      }

      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: isNewUser ? "USER_REGISTERED" : "USER_LOGGED_IN",
          details: JSON.stringify({ 
            message: isNewUser ? `New user registered via phone ${phone}` : `User logged in via phone OTP ${phone}`,
            phone,
            apCode: apCode || null 
          }),
          targetId: user.id.toString(),
          targetType: "User",
          ipAddress: req.ip || req.connection?.remoteAddress,
        },
      }).catch(err => console.error("[AuditLog Error]", err.message));

      const token = jwt.sign(
        { id: user.id, phone: user.phone, role: user.role },
        JWT_SECRET,
        { expiresIn: "7d" }
      );

      return res.json({
        success: true,
        token,
        user: { id: user.id, phone: user.phone, role: user.role }
      });
    }

    // For email verification only (no user creation/login)
    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: "USER_EMAIL_VERIFIED",
        details: JSON.stringify({ message: `Email OTP verified for ${email}`, email }),
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    res.json({ success: true, message: "Email verified successfully" });
  } catch (error) {
    next(error);
  }
};

const bcrypt = require("bcryptjs");

const adminLoginSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password too short"),
});

const createApSchema = z.object({
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().regex(/^[6-9]\d{9}$/, "Invalid phone number"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});


const globeLogin = async (req, res, next) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    
    const user = await prisma.user.findFirst({
      where: { 
        email,
        role: "globe"
      }
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials or unauthorized role" });
    }

    const bcrypt = require("bcryptjs");
    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "GLOBE_LOGGED_IN",
        details: JSON.stringify({ message: `Globe reviewer (${email}) logged in successfully`, email }),
        targetId: user.id.toString(),
        targetType: "GlobeUser",
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    next(error);
  }
};

// Globe password reset tokens are signed with the user's current password hash, so a token
// stops working as soon as the password changes (single-use) and expires after 30 minutes.
const GLOBE_RESET_PURPOSE = "globe-password-reset";

const globeForgotPasswordSchema = z.object({
  email: z.string().email("Invalid email"),
});

const globeResetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string()
    .min(6, "Password must be at least 6 characters")
    .regex(/[^A-Za-z0-9]/, "Password must contain at least one special character"),
});

const globeForgotPassword = async (req, res, next) => {
  try {
    const { email } = globeForgotPasswordSchema.parse(req.body);

    const user = await prisma.user.findFirst({
      where: { email, role: "globe" }
    });

    // Same response whether or not the email exists, so accounts can't be discovered here
    const genericResponse = {
      success: true,
      message: "If this email is registered with the Globe portal, a password reset link has been sent to it."
    };

    if (!user || !user.password) {
      return res.status(200).json(genericResponse);
    }

    const resetToken = jwt.sign(
      { id: user.id, purpose: GLOBE_RESET_PURPOSE },
      JWT_SECRET + user.password,
      { expiresIn: "30m" }
    );
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const resetLink = `${frontendUrl}/globe/reset-password?token=${resetToken}`;

    await emailService.sendPasswordResetEmail(user.email, resetLink);

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "GLOBE_PASSWORD_RESET_REQUESTED",
        details: JSON.stringify({ message: `Password reset link sent to Globe reviewer (${user.email})`, email: user.email }),
        targetId: user.id.toString(),
        targetType: "GlobeUser",
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    res.status(200).json(genericResponse);
  } catch (error) {
    next(error);
  }
};

const globeResetPassword = async (req, res, next) => {
  try {
    const { token, password } = globeResetPasswordSchema.parse(req.body);
    const invalidLink = { success: false, error: "This reset link is invalid or has expired. Please request a new one." };

    const decoded = jwt.decode(token);
    if (!decoded || decoded.purpose !== GLOBE_RESET_PURPOSE || !decoded.id) {
      return res.status(400).json(invalidLink);
    }

    const user = await prisma.user.findFirst({
      where: { id: decoded.id, role: "globe" }
    });
    if (!user || !user.password) {
      return res.status(400).json(invalidLink);
    }

    try {
      jwt.verify(token, JWT_SECRET + user.password);
    } catch (err) {
      return res.status(400).json(invalidLink);
    }

    const bcrypt = require("bcryptjs");
    const hashedPassword = await bcrypt.hash(password, 10);
    await prisma.user.update({
      where: { id: user.id },
      data: { password: hashedPassword }
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "GLOBE_PASSWORD_RESET",
        details: JSON.stringify({ message: `Globe reviewer (${user.email}) reset their password`, email: user.email }),
        targetId: user.id.toString(),
        targetType: "GlobeUser",
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    res.status(200).json({ success: true, message: "Password has been reset. You can now sign in with your new password." });
  } catch (error) {
    next(error);
  }
};

const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    
    const user = await prisma.user.findFirst({
      where: { 
        email,
        role: "admin"
      }
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials or unauthorized role" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "ADMIN_LOGGED_IN",
        details: JSON.stringify({ message: `Admin (${email}) logged in successfully`, email }),
        targetId: user.id.toString(),
        targetType: "AdminUser",
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role }
    });
  } catch (error) {
    next(error);
  }
};

const kycTeamLogin = async (req, res, next) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    
    // Check CRM database for KYC Team access
    const crmCheck = await crmService.checkKycTeamPermission(email);

    if (!crmCheck.authorized || !crmCheck.user.password) {
      console.warn(`[Auth] Failed login for ${email}: Not found or unauthorized role. Error:`, crmCheck.error || 'None');
      return res.status(401).json({ error: "Invalid credentials or unauthorized role" });
    }

    // Laravel PHP uses $2y$ bcrypt prefix, Node.js bcryptjs uses $2a$.
    // They are algorithmically identical — swap prefix for compatibility.
    let crmPasswordHash = crmCheck.user.password;
    if (crmPasswordHash.startsWith("$2y$")) {
      crmPasswordHash = "$2a$" + crmPasswordHash.slice(4);
    }

    const isValid = await bcrypt.compare(password, crmPasswordHash);
    if (!isValid) {
      console.warn(`[Auth] Failed login for ${email}: Password mismatch.`);
      return res.status(401).json({ error: "Invalid credentials" });
    }

    await prisma.auditLog.create({
      data: {
        crmAgentId: Number(crmCheck.user.id),
        crmAgentName: crmCheck.user.name || email,
        action: "MAKER_CHECKER_LOGGED_IN",
        details: JSON.stringify({ message: `Maker/Checker reviewer (${crmCheck.user.name || email}) logged in`, email }),
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    // Parse the stages from CRM (they are stored as JSON string in the DB)
    let kycStages = [];
    try {
      let userStages = [];
      let roleStages = [];
      
      if (crmCheck.user.kyc_portal_stages) {
        userStages = JSON.parse(crmCheck.user.kyc_portal_stages) || [];
      }
      
      if (crmCheck.user.role_kyc_stages) {
        roleStages = JSON.parse(crmCheck.user.role_kyc_stages) || [];
      }
      
      // Merge unique stages from both user-specific assignment and role-inherited assignment
      kycStages = [...new Set([...userStages, ...roleStages])];
    } catch (e) {
      console.warn("Could not parse kyc_portal_stages for user:", email);
    }

    const userRole = crmCheck.user.role_name === "AP" ? "AP" : "kyc_team";

    const token = jwt.sign(
      { id: crmCheck.user.id, email: crmCheck.user.email, role: userRole, kyc_stages: kycStages },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: { id: crmCheck.user.id, email: crmCheck.user.email, role: userRole, kyc_stages: kycStages }
    });
  } catch (error) {
    next(error);
  }
};

const kycSignupSchema = z.object({
  email: z.string().email("Invalid email"),
  password: z.string().min(6, "Password too short"),
  phone: z.string().min(10, "Invalid phone").optional(),
});

const kycTeamSignup = async (req, res, next) => {
  try {
    const { email, password, phone } = kycSignupSchema.parse(req.body);

    const existingUser = await prisma.user.findFirst({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "Email already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        phone: phone || `kyc_${Date.now()}`, // phone is unique in schema, provide fallback
        password: hashedPassword,
        role: "kyc_team"
      }
    });

    res.json({ success: true, message: "KYC Team member created successfully." });
  } catch (error) {
    next(error);
  }
};

// Setup route to create initial admin (only works if no admin exists)
const setupAdmin = async (req, res, next) => {
  try {
    const adminExists = await prisma.user.findFirst({ where: { role: "admin" } });
    if (adminExists) {
      return res.status(403).json({ error: "Admin already exists" });
    }

    const { email, password, phone } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role: "admin"
      }
    });

    res.json({ success: true, message: "Initial admin created" });
  } catch (error) {
    next(error);
  }
};

const apLogin = async (req, res, next) => {
  try {
    const { email, password } = adminLoginSchema.parse(req.body);
    
    const user = await prisma.user.findFirst({
      where: { 
        email,
        role: "ap"
      }
    });

    if (!user || !user.password) {
      return res.status(401).json({ error: "Invalid credentials or unauthorized role" });
    }

    if (user.status === "suspended") {
      return res.status(403).json({ error: "Your account has been suspended. Please contact admin." });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const apCode = `AP${user.id}`;
    const name = user.metadata ? (() => { try { return JSON.parse(user.metadata).name || ''; } catch { return ''; } })() : '';

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: "AP_LOGGED_IN",
        details: JSON.stringify({ message: `AP (${name || email}) logged in successfully`, email }),
        targetId: user.id.toString(),
        targetType: "APUser",
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, apCode, name },
      JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({
      success: true,
      token,
      user: { id: user.id, email: user.email, role: user.role, apCode, name, phone: user.phone }
    });
  } catch (error) {
    next(error);
  }
};

const createAp = async (req, res, next) => {
  try {
    const { name, email, phone, password } = createApSchema.parse(req.body);

    // Check for existing email or phone
    const existingEmail = await prisma.user.findFirst({ where: { email } });
    if (existingEmail) {
      return res.status(400).json({ error: "Email already in use" });
    }
    const existingPhone = await prisma.user.findFirst({ where: { phone } });
    if (existingPhone) {
      return res.status(400).json({ error: "Phone number already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email,
        phone,
        password: hashedPassword,
        role: "ap",
        metadata: JSON.stringify({ name }),
      }
    });

    const apCode = `AP${user.id}`;

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        action: "AP_CREATED",
        details: JSON.stringify({ message: `AP created: ${name} (${email})`, apCode, name, email, phone }),
        targetId: user.id.toString(),
        targetType: "APUser",
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    res.json({
      success: true,
      message: "AP created successfully",
      ap: { id: user.id, email, phone, name, apCode }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Client-side logout handler.
 * Tokens are stateless JWTs stored client-side, so logout is primarily a
 * client-side cleanup. The server-side step records the logout event in the
 * audit log for accountability and tracks session termination.
 */
const logout = async (req, res, next) => {
  try {
    // req.user is already set by the auth middleware at the route level
    const userId = req.user?.id;
    const userRole = req.user?.role || "unknown";

    // Record the logout event in audit log
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        action: "USER_LOGGED_OUT",
        details: JSON.stringify({
          message: `User ${userRole} (${userId}) logged out`,
          role: userRole,
          userId: userId,
          ipAddress: req.ip || req.connection?.remoteAddress,
        }),
        ipAddress: req.ip || req.connection?.remoteAddress,
      },
    }).catch(err => console.error("[AuditLog Error]", err.message));

    res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
  adminLogin,
  globeLogin,
  globeForgotPassword,
  globeResetPassword,
  kycTeamLogin,
  kycTeamSignup,
  setupAdmin,
  apLogin,
  createAp,
  logout,
};

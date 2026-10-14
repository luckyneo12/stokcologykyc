const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const mobileSelfieSession = require("../utils/mobileSelfieSession");

const JWT_SECRET = process.env.JWT_SECRET || "kyc-secret-key-change-in-production";

const auth = async (req, res, next) => {
  let token = req.headers.authorization?.split(" ")[1] || req.query?.token;
  if (token === "null" || token === "undefined") token = null;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // QR selfie link: a newer QR was generated on the desktop — this one no longer works
    if (mobileSelfieSession.isReplaced(decoded)) {
      return res.status(401).json({ error: "This QR code was replaced by a newer one.", code: "MOBILE_SESSION_REPLACED" });
    }
    // Verified claims of the token itself (req.user also merges in the DB user record)
    req.tokenClaims = decoded;
    
    // For CRM KYC Team agents, their ID belongs to the CRM DB, not the local DB.
    // Fetching from the local DB would risk ID collisions with regular users,
    // which would overwrite the agent's role and email.
    if (decoded.role === "kyc_team") {
      req.user = decoded;
      return next();
    }

    // Check if user exists in MySQL
    const user = await prisma.user.findUnique({
      where: { id: parseInt(decoded.id) || 0 }
    });

    if (!user && decoded.id !== "demo") {
      return res.status(401).json({ error: "User not found in local database" });
    }

    req.user = { ...decoded, ...user };
    next();
  } catch (error) {
    console.error("[Auth Error] JWT Verify Failed:", error.message);
    if (error.name === "TokenExpiredError") return res.status(401).json({ error: "Invalid token", code: "TOKEN_EXPIRED" });
    res.status(401).json({ error: "Invalid token" });
  }
};

const adminAuth = (req, res, next) => {
  auth(req, res, () => {
    if (!["admin", "kyc_team"].includes(req.user.role)) {
      return res.status(403).json({ error: "Admin/KYC team access required" });
    }
    next();
  });
};

const apAuth = (req, res, next) => {
  auth(req, res, () => {
    if (req.user.role !== "ap" && req.user.role !== "admin") {
      return res.status(403).json({ error: "AP access required" });
    }
    next();
  });
};

module.exports = { auth, adminAuth, apAuth };

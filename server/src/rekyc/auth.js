const jwt = require("jsonwebtoken");
const { queryOne } = require("./db");
const { hasPermission, permissionsFor } = require("./permissions");

// Signed with a ReKYC-only secret: tokens of the other portals are not valid here and
// ReKYC tokens are not valid on the other portals.
const SECRET = process.env.REKYC_JWT_SECRET || `${process.env.JWT_SECRET || "kyc-secret-key-change-in-production"}::rekyc`;
const CLIENT_AUDIENCE = "rekyc-client";
const ADMIN_AUDIENCE = "rekyc-admin";

function signClientToken(payload) {
  return jwt.sign(payload, SECRET, { audience: CLIENT_AUDIENCE, expiresIn: "2h" });
}

function signAdminToken(payload) {
  return jwt.sign(payload, SECRET, { audience: ADMIN_AUDIENCE, expiresIn: "12h" });
}

function readBearer(req) {
  const token = req.headers.authorization?.split(" ")[1];
  return token && token !== "null" && token !== "undefined" ? token : null;
}

function verify(token, audience) {
  return jwt.verify(token, SECRET, { audience });
}

const clientAuth = (req, res, next) => {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ success: false, error: "Please log in again." });
  try {
    const claims = verify(token, CLIENT_AUDIENCE);
    req.rekycClient = { clientCode: claims.clientCode, requestId: claims.requestId };
    next();
  } catch (error) {
    res.status(401).json({ success: false, code: "SESSION_EXPIRED", error: "Your session has expired. Please log in again." });
  }
};

const adminAuth = async (req, res, next) => {
  const token = readBearer(req);
  if (!token) return res.status(401).json({ success: false, error: "Please log in." });
  let claims;
  try {
    claims = verify(token, ADMIN_AUDIENCE);
  } catch (error) {
    return res.status(401).json({ success: false, code: "SESSION_EXPIRED", error: "Your session has expired. Please log in again." });
  }
  try {
    // Role and status are re-read on every request, so a deactivated user or a role change takes effect at once
    const user = await queryOne("SELECT id, name, email, role, status FROM rekyc_admin_users WHERE id = ?", [claims.id]);
    if (!user || user.status !== "active") {
      return res.status(401).json({ success: false, error: "Your account is inactive. Contact the ReKYC administrator." });
    }
    req.rekycAdmin = { ...user, permissions: permissionsFor(user.role) };
    next();
  } catch (error) {
    next(error);
  }
};

const requirePermission = (permission) => (req, res, next) => {
  if (!req.rekycAdmin || !hasPermission(req.rekycAdmin.role, permission)) {
    return res.status(403).json({ success: false, error: "You do not have permission for this action." });
  }
  next();
};

module.exports = { signClientToken, signAdminToken, clientAuth, adminAuth, requirePermission };

/**
 * ReKYC one-time setup (run from the server folder):
 *
 *   node scripts/rekyc-setup.js
 *     → creates the rekyc_* tables (CREATE TABLE IF NOT EXISTS only — existing tables are never changed)
 *
 *   node scripts/rekyc-setup.js --admin-email you@company.com --admin-name "Your Name" --admin-password "StrongPass@123"
 *     → also creates the first ReKYC super admin (skipped if that email already exists)
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const fs = require("fs");
const bcrypt = require("bcryptjs");
const { query, queryOne, getPool } = require("../src/rekyc/db");

function arg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index > -1 ? process.argv[index + 1] : null;
}

async function main() {
  const sql = fs.readFileSync(path.join(__dirname, "..", "src", "rekyc", "schema.sql"), "utf8");
  const statements = sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);

  for (const statement of statements) {
    if (!/^CREATE TABLE IF NOT EXISTS rekyc_/i.test(statement)) {
      throw new Error(`Refusing to run a statement that is not a ReKYC CREATE TABLE IF NOT EXISTS:\n${statement.slice(0, 120)}`);
    }
    await query(statement);
    console.log(`✔ ${statement.match(/rekyc_[a-z_]+/i)[0]}`);
  }

  const email = arg("admin-email");
  if (email) {
    const name = arg("admin-name") || "ReKYC Admin";
    const password = arg("admin-password");
    if (!password || password.length < 8) throw new Error("--admin-password must be at least 8 characters");
    const existing = await queryOne("SELECT id FROM rekyc_admin_users WHERE email = ?", [email.toLowerCase()]);
    if (existing) {
      console.log(`ℹ ReKYC admin ${email} already exists (id ${existing.id}) — not changed`);
    } else {
      const hash = await bcrypt.hash(password, 10);
      await query(
        "INSERT INTO rekyc_admin_users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'rekyc_admin', 'active')",
        [name, email.toLowerCase(), hash]
      );
      console.log(`✔ ReKYC super admin created: ${email}`);
    }
  }

  await getPool().end();
  console.log("ReKYC setup complete.");
}

main().catch(async (error) => {
  console.error("ReKYC setup failed:", error.message);
  try { await getPool().end(); } catch (e) {}
  process.exit(1);
});

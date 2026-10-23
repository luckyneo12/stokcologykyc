/**
 * ReKYC: look up a client in the back office (read-only — no OTP, no login, nothing is saved).
 * Run from the server folder:
 *
 *   node scripts/rekyc-fetch.js CLIENTCODE          → what the ReKYC portal would show
 *   node scripts/rekyc-fetch.js CLIENTCODE --raw    → also the full back office record
 */
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });
const backofficeService = require("../src/services/backofficeService");
const { toProfile, isMock } = require("../src/rekyc/clientProfile");

async function main() {
  const clientCode = String(process.argv[2] || "").trim().toUpperCase();
  const showRaw = process.argv.includes("--raw");
  if (!clientCode || clientCode.startsWith("--")) {
    console.log("Usage: node scripts/rekyc-fetch.js CLIENTCODE [--raw]");
    process.exit(1);
  }
  if (isMock()) console.warn("Note: REKYC_BACKOFFICE_MOCK is on in .env, but this script always asks the real back office.\n");

  const baseUrl = (process.env.BACKOFFICE_BASE_URL || "http://61.247.230.203:15000/api").replace(/\/+$/, "");
  console.log(`Back office: ${baseUrl}`);
  console.log(`Client code: ${clientCode}\n`);

  let raw;
  let step = "login (token)";
  try {
    await backofficeService.getToken();
    console.log("✔ Back office login (token) OK");
    step = "client lookup (GetOrionEKYCDetail)";
    raw = await backofficeService.fetchExistingClientDetail(clientCode, "A");
  } catch (error) {
    console.error(`✖ Failed at step: ${step}`);
    const status = error.response?.status;
    console.error("✖ Back office request failed.");
    console.error(`  Reason : ${error.code || ""} ${error.message}`.trim());
    if (status) console.error(`  HTTP   : ${status}`);
    if (error.response?.data) console.error(`  Detail : ${JSON.stringify(error.response.data).slice(0, 500)}`);
    if (["ECONNABORTED", "ETIMEDOUT", "ECONNREFUSED", "EHOSTUNREACH", "ENOTFOUND"].includes(error.code) || /timeout/i.test(error.message)) {
      console.error("\n  → The server cannot reach the back office address above (network / VPN / wrong BACKOFFICE_BASE_URL).");
    } else if (error.code === "ECONNRESET" || /socket hang up/i.test(error.message)) {
      console.error("\n  → The back office was reached but closed the connection. Usually: this machine's IP is not allowed");
      console.error("    by the back office firewall, a VPN/proxy is cutting it, or the back office service is restarting.");
    } else if (status === 401 || /token|credential/i.test(error.message)) {
      console.error("\n  → The back office rejected the login (check BACKOFFICE_USERNAME / BACKOFFICE_PASSWORD).");
    }
    process.exit(1);
  }

  const profile = toProfile(raw, clientCode);
  if (!profile.name && !profile.pan) {
    console.log("✖ The back office answered, but has no client with this code.");
    if (showRaw) console.log("\nRaw response:\n" + JSON.stringify(raw, null, 2));
    process.exit(0);
  }

  console.log("✔ Client found. This is what the ReKYC portal will show:\n");
  console.log(JSON.stringify(profile, null, 2));
  if (showRaw) console.log("\nFull back office record:\n" + JSON.stringify(raw, null, 2));
  process.exit(0);
}

main().catch((error) => {
  console.error("Unexpected error:", error.message);
  process.exit(1);
});

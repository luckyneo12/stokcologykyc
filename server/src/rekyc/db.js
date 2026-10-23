const mysql = require("mysql2/promise");

// ReKYC keeps its own tables (rekyc_*) and its own connection pool, so nothing in the
// shared Prisma schema or the other portals' tables is touched.
let pool = null;

function getPool() {
  if (pool) return pool;
  const url = process.env.REKYC_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured");
  pool = mysql.createPool({
    uri: url,
    waitForConnections: true,
    connectionLimit: Number(process.env.REKYC_DB_POOL_SIZE || 5),
    dateStrings: false,
    timezone: "Z",
  });
  return pool;
}

async function query(sql, params = []) {
  const [rows] = await getPool().query(sql, params);
  return rows;
}

async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

function parseJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (e) {
    return fallback;
  }
}

function toJson(value) {
  return value === undefined || value === null ? null : JSON.stringify(value);
}

module.exports = { getPool, query, queryOne, parseJson, toJson };

import pg from "pg";
const { Pool } = pg;

// Clean up DATABASE_URL
let cleanUrl = process.env.DATABASE_URL || "";
cleanUrl = cleanUrl.trim();
if (cleanUrl.startsWith("DATABASE_URL=")) {
  cleanUrl = cleanUrl.substring("DATABASE_URL=".length).trim();
}
if ((cleanUrl.startsWith('"') && cleanUrl.endsWith('"')) || (cleanUrl.startsWith("'") && cleanUrl.endsWith("'"))) {
  cleanUrl = cleanUrl.substring(1, cleanUrl.length - 1).trim();
}

console.log("Connecting to:", cleanUrl);

const pool = new Pool({ connectionString: cleanUrl });

async function main() {
  const client = await pool.connect();
  try {
    const res = await client.query("SELECT id, name, email, role, system_role, is_active FROM users");
    console.log("Users in DB:");
    console.log(res.rows);
  } catch (err) {
    console.error("Error querying DB:", err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();

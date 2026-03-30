import pkg from "pg";
const { Pool } = pkg;

async function test() {
  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
    });

    const res = await pool.query("SELECT 1");
    console.log("✅ DB Connected:", res.rows);

    await pool.end();
  } catch (err) {
    console.error("❌ DB Error:", err);
  }
}

test();

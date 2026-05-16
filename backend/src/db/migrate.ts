import "dotenv/config";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createDatabasePool } from "./pool.js";

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run database migrations");
  }

  const currentDir = dirname(fileURLToPath(import.meta.url));
  const schemaSql = await readFile(resolve(currentDir, "schema.sql"), "utf8");
  const pool = createDatabasePool(databaseUrl);

  try {
    await pool.query(schemaSql);
    console.log("CERA wallet database schema is ready");
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

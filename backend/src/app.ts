import express from "express";
import { config } from "./config/index.js";
import { createDatabasePool } from "./db/pool.js";
import { RpcClient } from "./rpc/client.js";
import { createApiRouter } from "./routes/index.js";

async function main() {
  const rpc = new RpcClient(config.rpcUrl, config.rpcTimeoutMs);
  const app = express();
  const allowedOrigin = process.env.CORS_ORIGIN?.trim() || "http://127.0.0.1:5173";

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", allowedOrigin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json({ limit: "256kb" }));

  const database = config.databaseUrl
    ? createDatabasePool(config.databaseUrl)
    : undefined;

  if (database) {
    await database.query("SELECT 1");
    console.log("PostgreSQL connected");
  } else {
    console.log("PostgreSQL skipped (no DATABASE_URL)");
  }

  app.use("/api", createApiRouter(rpc, { database }));

  app.listen(config.port, () => {
    console.log(`Wallet backend http://127.0.0.1:${config.port}`);
    console.log(`CERA RPC → ${config.rpcUrl}`);
    if (config.allowInsecureDevKeyBody) {
      console.warn("⚠️  ALLOW_INSECURE_DEV_KEY_BODY=true (dev only)");
    }
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

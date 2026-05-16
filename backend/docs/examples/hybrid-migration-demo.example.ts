import axios from "axios";

const baseURL = process.env.CERA_WALLET_BASE_URL ?? "http://127.0.0.1:3000/api";
const from = process.env.CERA_FROM_ADDRESS ?? "";
const telegramUserId = process.env.CERA_TELEGRAM_USER_ID ?? "demo-user";
const signedMigrationTxJson = process.env.CERA_SIGNED_MIGRATION_TX_JSON ?? "";

async function main() {
  if (!from || !signedMigrationTxJson) {
    throw new Error(
      "Set CERA_FROM_ADDRESS and CERA_SIGNED_MIGRATION_TX_JSON before running this demo. Sign locally; do not send privateKey, pqPrivateKey, seed, or mnemonic to cera-wallet."
    );
  }

  const client = axios.create({ baseURL, timeout: 30_000 });

  const before = await client.get("/wallet/account/post-quantum-readiness", {
    params: { ceraAddress: from },
  });
  console.log("1. readiness before migration");
  console.dir(before.data, { depth: null });

  const register = await client.post("/wallet/account/register", {
    telegramUserId,
    ceraAddress: from,
    accountType: "legacy_ed25519",
    authMode: "single",
    keyMaterialRef: "demo:ed25519",
  });
  console.log("2. local account registration");
  console.dir(register.data, { depth: null });

  const prepare = await client.post("/wallet/account/prepare-hybrid-migration", {
    telegramUserId,
    ceraAddress: from,
    pqPublicKey: "derived-by-wallet-during-real-flow",
    pqKeyMaterialRef: "demo:mldsa65",
  });
  console.log("3. local hybrid preparation");
  console.dir(prepare.data, { depth: null });

  const signedMigrationTx = JSON.parse(signedMigrationTxJson);
  if (
    signedMigrationTx.privateKey !== undefined ||
    signedMigrationTx.pqPrivateKey !== undefined ||
    signedMigrationTx.mnemonic !== undefined ||
    signedMigrationTx.seed !== undefined
  ) {
    throw new Error("Signed migration payload must not contain client secrets");
  }

  const migrate = await client.post("/tx/migrate-hybrid", signedMigrationTx);
  console.log("4. submitted on-chain migration");
  console.dir(migrate.data, { depth: null });

  const after = await client.get("/wallet/account/post-quantum-readiness", {
    params: { ceraAddress: from },
  });
  console.log("5. readiness after migration");
  console.dir(after.data, { depth: null });
}

main().catch((error) => {
  console.error("hybrid migration demo failed");
  console.error(error);
  process.exit(1);
});

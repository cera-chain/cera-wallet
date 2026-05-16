import "dotenv/config";

function env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined || v === "") {
    throw new Error(`Missing required env: ${name}`);
  }
  return v;
}

export const config = {
  rpcUrl: env("RPC_URL", "http://127.0.0.1:8545"),
  /** JSON-RPC HTTP 超时（毫秒），超时未响应会抛错，避免无限挂起 */
  rpcTimeoutMs: Number.parseInt(process.env.RPC_TIMEOUT_MS ?? "30000", 10),
  port: Number.parseInt(process.env.PORT ?? "3000", 10),
  databaseUrl: process.env.DATABASE_URL?.trim() || undefined,
  /** 仅本地调试：允许在 body 里传 privateKey / seedHex */
  allowInsecureDevKeyBody: process.env.ALLOW_INSECURE_DEV_KEY_BODY === "true",
  /** 服务端默认签名种子（仍属托管模型） */
  ed25519SeedHex: process.env.CERA_ED25519_SEED_HEX?.trim() || undefined,
} as const;

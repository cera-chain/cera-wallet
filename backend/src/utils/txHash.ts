import { createHash } from "node:crypto";

/**
 * 与 `cera_execution::node_format::Transaction::hash` 一致（mempool / RPC tx id）。
 * 串联：from_utf8 | to_utf8 | amount_be | nonce_be | fee_be
 * | migration_fields?
 * | staking_fields?
 * | is_coinbase(1 byte)
 * **不包含** signature。
 */
export function transactionIdPreimage(input: {
  from: string | undefined;
  to: string;
  amount: bigint;
  nonce: bigint;
  fee: bigint;
  migration?: {
    target_auth_mode: string;
    target_account_type: string;
    target_account_keys: Array<{
      scheme: string;
      public_key: string;
      key_id?: string;
    }>;
    target_migration_version?: number;
  };
  staking?: {
    kind: string;
    validator_address?: string;
    consensus_public_key?: string;
  };
  isCoinbase: boolean;
}): Buffer {
  const fromBytes = input.from ? Buffer.from(input.from, "utf8") : Buffer.alloc(0);
  const toBytes = Buffer.from(input.to, "utf8");
  const parts: Buffer[] = [
    fromBytes,
    toBytes,
    u64Be(input.amount),
    u64Be(input.nonce),
    u64Be(input.fee),
  ];

  if (input.migration) {
    parts.push(Buffer.from(input.migration.target_auth_mode, "utf8"));
    parts.push(Buffer.from(input.migration.target_account_type, "utf8"));
    for (const key of input.migration.target_account_keys) {
      parts.push(Buffer.from(key.scheme, "utf8"));
      parts.push(Buffer.from(key.public_key, "utf8"));
      parts.push(Buffer.from(key.key_id ?? "", "utf8"));
    }
    parts.push(u32Be(BigInt(input.migration.target_migration_version ?? 0)));
  }

  if (input.staking) {
    parts.push(Buffer.from(input.staking.kind, "utf8"));
    parts.push(Buffer.from(input.staking.validator_address ?? "", "utf8"));
    parts.push(Buffer.from(input.staking.consensus_public_key ?? "", "utf8"));
  }

  parts.push(Buffer.from([input.isCoinbase ? 1 : 0]));
  return Buffer.concat(parts);
}

/** 与节点 `Transaction::hash()` 相同的 32 字节 SHA-256 digest（签名应对该字节序列签名）。 */
export function transactionIdHashBytes(
  input: Parameters<typeof transactionIdPreimage>[0]
): Uint8Array {
  const preimage = transactionIdPreimage(input);
  return new Uint8Array(createHash("sha256").update(preimage).digest());
}

export function transactionIdHashHex(input: Parameters<typeof transactionIdPreimage>[0]): string {
  const bytes = transactionIdHashBytes(input);
  return `0x${Buffer.from(bytes).toString("hex")}`;
}

function u64Be(n: bigint): Buffer {
  if (n < 0n || n > 0xffff_ffff_ffff_ffffn) {
    throw new RangeError("u64 out of range");
  }
  const buf = Buffer.allocUnsafe(8);
  buf.writeBigUInt64BE(n, 0);
  return buf;
}

function u32Be(n: bigint): Buffer {
  if (n < 0n || n > 0xffff_ffffn) {
    throw new RangeError("u32 out of range");
  }
  const buf = Buffer.allocUnsafe(4);
  buf.writeUInt32BE(Number(n), 0);
  return buf;
}

/** 将字符串金额解析为 bigint（十进制） */
export function parseAmountString(s: string): bigint {
  const t = s.trim();
  if (!/^\d+$/.test(t)) throw new Error(`Invalid amount string: ${s}`);
  return BigInt(t);
}

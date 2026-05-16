/**
 * CERA: standard send_transaction client (shared by Bot / Web / App)
 *
 * Rules: trust RPC for nonce only; retry only on ERR_NONCE_TOO_LOW / ERR_NONCE_TOO_HIGH
 * after refreshing get_wallet_summary.
 * Depends on your rpc(method, params) -> { result } | throws implementation.
 *
 * ⚠️ On retry, do not locally nonce++ or use lastNonce+1; each attempt must await
 * getWalletSummary() and build the transaction with the fresh nonce.
 */

const MAX_NONCE_RETRIES = 3;

type RpcResult = { success: true; hash: string } | { success: false; error: string; message?: string; expected_next_nonce?: number };

export async function rpc(method: string, params: unknown): Promise<{ result: unknown }> {
  throw new Error("Implement rpc() for your stack (fetch / axios / telegram bot backend, etc.)");
}

/** Extract the send_transaction result object from a JSON-RPC response */
function parseSendResult(body: { result: unknown }): RpcResult {
  const r = body.result as Record<string, unknown>;
  if (r && r.success === true && typeof r.hash === "string") {
    return { success: true, hash: r.hash };
  }
  if (r && r.success === false && typeof r.error === "string") {
    return {
      success: false,
      error: r.error,
      message: typeof r.message === "string" ? r.message : undefined,
      expected_next_nonce: typeof r.expected_next_nonce === "number" ? r.expected_next_nonce : undefined,
    };
  }
  throw new Error("Unexpected send_transaction result shape");
}

export async function getWalletSummary(address: string): Promise<{ next_nonce: number }> {
  const { result } = await rpc("get_wallet_summary", { address });
  const o = result as Record<string, unknown>;
  const n = o.next_nonce ?? o.nonce;
  if (typeof n !== "number") throw new Error("get_wallet_summary missing next_nonce");
  return { next_nonce: n };
}

/** Build params with your fields (signing happens inside buildSignedTxParams) */
export type BuildTxParams = (nonce: number) => Promise<Record<string, unknown>>;

export async function sendTransactionWithNonceRetry(
  address: string,
  buildSignedTxParams: BuildTxParams
): Promise<{ hash: string }> {
  for (let attempt = 0; attempt < MAX_NONCE_RETRIES; attempt++) {
    const { next_nonce } = await getWalletSummary(address);
    const params = await buildSignedTxParams(next_nonce);
    const { result } = await rpc("send_transaction", params);
    const out = parseSendResult({ result });

    if (out.success) return { hash: out.hash };

    // ⚠️ Do not increment nonce here; getWalletSummary() at the top of the next loop provides authoritative next_nonce
    if (out.error === "ERR_NONCE_TOO_LOW" || out.error === "ERR_NONCE_TOO_HIGH") {
      continue;
    }

    throw new Error(`send_transaction failed: ${out.error} — ${out.message ?? ""}`);
  }

  throw new Error(`send_transaction: exhausted ${MAX_NONCE_RETRIES} nonce retries`);
}

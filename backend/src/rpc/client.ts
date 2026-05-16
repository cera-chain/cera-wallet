import axios, { type AxiosInstance } from "axios";
import type { JsonRpcResponse, SendTransactionResult } from "./types.js";

export class RpcError extends Error {
  constructor(
    message: string,
    public readonly code?: number,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = "RpcError";
  }
}

export class RpcClient {
  private readonly http: AxiosInstance;
  private readonly timeoutMs: number;

  constructor(
    private readonly url: string,
    timeoutMs = 30_000
  ) {
    this.timeoutMs = timeoutMs;
    this.http = axios.create({
      baseURL: url,
      timeout: timeoutMs,
      headers: { "Content-Type": "application/json" },
      validateStatus: (s) => s >= 200 && s < 300,
    });
  }

  /**
   * 通用 JSON-RPC。仅处理顶层 `error`；业务失败（如 send_transaction）见 `callSendTransaction`。
   */
  async call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    const body = {
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params,
    };

    let data: JsonRpcResponse<T>;
    try {
      const res = await this.http.post<JsonRpcResponse<T>>("", body);
      data = res.data;
    } catch (e: unknown) {
      if (axios.isAxiosError(e)) {
        if (e.code === "ECONNABORTED" || e.message.toLowerCase().includes("timeout")) {
          throw new RpcError(
            `RPC timeout after ${this.timeoutMs}ms (${method}) — 检查 CERA 节点是否启动、RPC_URL 是否正确`,
            undefined,
            { code: e.code }
          );
        }
        throw new RpcError(
          e.message ?? "RPC network error",
          undefined,
          e.response?.data
        );
      }
      throw e;
    }

    if (data.error) {
      throw new RpcError(data.error.message, data.error.code, data.error.data);
    }

    if (data.result === undefined) {
      throw new RpcError("RPC response missing result");
    }

    return data.result as T;
  }

  /**
   * send_transaction：业务失败在 `result.success === false`，HTTP/jsonrpc 仍可能成功。
   */
  async callSendTransaction(params: Record<string, unknown>): Promise<SendTransactionResult> {
    const raw = await this.call<SendTransactionResult>("send_transaction", params);
    if (raw && typeof raw === "object" && "success" in raw) {
      return raw as SendTransactionResult;
    }
    throw new RpcError("Unexpected send_transaction result shape");
  }
}

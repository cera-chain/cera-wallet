/** Optional local audit / Bot display record. Chain truth still comes from RPC. */
export interface TxRecord {
  txRecordId: number;
  from: string;
  to: string;
  amount: string;
  fee?: string | null;
  txHash?: string | null;
  status: "pending" | "confirmed" | "failed";
  error?: string | null;
  createdAt: Date;
}

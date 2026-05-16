/**
 * 加密相关工具（密钥派生、脱敏等可在此扩展）。
 * Ed25519 seed 解析见 `../services/signer.ts` 的 `seedFromHex64`。
 */
export function redactHex(input: string, visible = 6): string {
  if (input.length <= visible * 2) return "***";
  return `${input.slice(0, visible)}…${input.slice(-visible)}`;
}

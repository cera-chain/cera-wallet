import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { hmac } from "@noble/hashes/hmac";
import { sha512 } from "@noble/hashes/sha512";

export const CERA_MNEMONIC_DERIVATION_SCHEME = "cera-mnemonic-v1" as const;
export const CERA_MNEMONIC_DERIVATION_PATH = "m/44'/68291'/0'/0'/0'" as const;

const HARDENED_OFFSET = 0x80000000;
const CERA_DERIVATION_INDEXES = [44, 68291, 0, 0, 0] as const;

function ser32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  const view = new DataView(out.buffer);
  view.setUint32(0, value, false);
  return out;
}

function concatBytes(...items: Uint8Array[]): Uint8Array {
  const length = items.reduce((total, item) => total + item.length, 0);
  const out = new Uint8Array(length);
  let offset = 0;
  for (const item of items) {
    out.set(item, offset);
    offset += item.length;
  }
  return out;
}

function split64(bytes: Uint8Array): { left: Uint8Array; right: Uint8Array } {
  return {
    left: bytes.slice(0, 32),
    right: bytes.slice(32, 64),
  };
}

function slip10MasterKey(seed: Uint8Array) {
  return split64(hmac(sha512, Buffer.from("ed25519 seed", "utf8"), seed));
}

function deriveHardenedChild(key: Uint8Array, chainCode: Uint8Array, index: number) {
  const hardenedIndex = index + HARDENED_OFFSET;
  const data = concatBytes(new Uint8Array([0]), key, ser32(hardenedIndex));
  return split64(hmac(sha512, chainCode, data));
}

export function normalizeMnemonic(mnemonic: string): string {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
}

export function generateCeraMnemonic(): string {
  return generateMnemonic(wordlist, 256);
}

export function privateKeySeedFromMnemonic(mnemonic: string): Uint8Array {
  const normalized = normalizeMnemonic(mnemonic);
  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error("mnemonic must be a valid 24-word BIP39 English mnemonic");
  }

  const seed = mnemonicToSeedSync(normalized);
  let current = slip10MasterKey(seed);
  for (const index of CERA_DERIVATION_INDEXES) {
    current = deriveHardenedChild(current.left, current.right, index);
  }
  return current.left;
}

export function privateKeyHexFromMnemonic(mnemonic: string): string {
  return Buffer.from(privateKeySeedFromMnemonic(mnemonic)).toString("hex");
}

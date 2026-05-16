import * as ed from "@noble/ed25519";
import { sha512 } from "@noble/hashes/sha512";
import { hmac } from "@noble/hashes/hmac";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils";
import { generateMnemonic, mnemonicToSeedSync, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { legacyHexToCeraAddress } from "../utils/cera-address";

ed.etc.sha512Sync = (...messages: Uint8Array[]) =>
  sha512(ed.etc.concatBytes(...messages));

export const CERA_MNEMONIC_DERIVATION_SCHEME = "cera-mnemonic-v1" as const;
export const CERA_MNEMONIC_DERIVATION_PATH = "m/44'/68291'/0'/0'/0'" as const;

const hardenedOffset = 0x80000000;
const ceraDerivationIndexes = [44, 68291, 0, 0, 0] as const;

export type LocalWalletMaterial = {
  address: string;
  legacyAddress: string;
  publicKey: string;
  privateKey: string;
  mnemonic?: string;
  mnemonicWordCount?: 24;
  derivationScheme?: typeof CERA_MNEMONIC_DERIVATION_SCHEME;
  derivationPath?: typeof CERA_MNEMONIC_DERIVATION_PATH;
  coinType?: number;
  accountIndex?: number;
  addressIndex?: number;
};

function withHexPrefix(value: string) {
  return value.toLowerCase().startsWith("0x") ? value : `0x${value}`;
}

function ser32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, false);
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

function split64(bytes: Uint8Array) {
  return {
    left: bytes.slice(0, 32),
    right: bytes.slice(32, 64)
  };
}

function normalizeMnemonic(mnemonic: string) {
  return mnemonic.trim().toLowerCase().replace(/\s+/g, " ");
}

function slip10MasterKey(seed: Uint8Array) {
  return split64(hmac(sha512, utf8ToBytes("ed25519 seed"), seed));
}

function deriveHardenedChild(key: Uint8Array, chainCode: Uint8Array, index: number) {
  const data = concatBytes(new Uint8Array([0]), key, ser32(index + hardenedOffset));
  return split64(hmac(sha512, chainCode, data));
}

function privateKeySeedFromMnemonic(mnemonic: string): Uint8Array {
  const normalized = normalizeMnemonic(mnemonic);

  if (!validateMnemonic(normalized, wordlist)) {
    throw new Error("mnemonic must be a valid 24-word BIP39 English mnemonic");
  }

  let current = slip10MasterKey(mnemonicToSeedSync(normalized));
  for (const index of ceraDerivationIndexes) {
    current = deriveHardenedChild(current.left, current.right, index);
  }

  return current.left;
}

function normalizePrivateKeyHex(privateKey: string) {
  const clean = privateKey.trim().replace(/^0x/i, "");
  if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
    throw new Error("privateKey must be 64 hex chars (32-byte Ed25519 seed)");
  }
  return clean.toLowerCase();
}

function walletFromSeed(seed: Uint8Array, extra: Partial<LocalWalletMaterial> = {}): LocalWalletMaterial {
  const publicKeyHex = bytesToHex(ed.getPublicKey(seed));
  const legacyAddress = `0x${publicKeyHex}`;
  return {
    address: legacyHexToCeraAddress(legacyAddress),
    legacyAddress,
    publicKey: `0x${publicKeyHex}`,
    privateKey: `0x${bytesToHex(seed)}`,
    ...extra
  };
}

export function createLocalPrivateKeyWallet(): LocalWalletMaterial {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  return walletFromSeed(seed);
}

export function createLocalMnemonicWallet(): LocalWalletMaterial {
  const mnemonic = generateMnemonic(wordlist, 256);
  return walletFromSeed(privateKeySeedFromMnemonic(mnemonic), {
    mnemonic,
    mnemonicWordCount: 24,
    derivationScheme: CERA_MNEMONIC_DERIVATION_SCHEME,
    derivationPath: CERA_MNEMONIC_DERIVATION_PATH,
    coinType: 68291,
    accountIndex: 0,
    addressIndex: 0
  });
}

export function importLocalPrivateKeyWallet(privateKey: string): LocalWalletMaterial {
  return walletFromSeed(hexToBytes(normalizePrivateKeyHex(privateKey)));
}

export function importLocalMnemonicWallet(mnemonic: string): LocalWalletMaterial {
  const normalized = normalizeMnemonic(mnemonic);
  return walletFromSeed(privateKeySeedFromMnemonic(normalized), {
    mnemonic: normalized,
    mnemonicWordCount: 24,
    derivationScheme: CERA_MNEMONIC_DERIVATION_SCHEME,
    derivationPath: CERA_MNEMONIC_DERIVATION_PATH,
    coinType: 68291,
    accountIndex: 0,
    addressIndex: 0
  });
}

export function buildWalletRegistrationPayload(wallet: LocalWalletMaterial) {
  return {
    ceraAddress: wallet.address,
    accountType: "legacy_ed25519",
    authMode: "single",
    ed25519PublicKey: withHexPrefix(wallet.publicKey),
    keyMaterialRef: wallet.derivationScheme ? "client-held:bip39" : "client-held:ed25519",
    ...(wallet.derivationScheme ? { derivationScheme: wallet.derivationScheme } : {}),
    ...(wallet.derivationPath ? { derivationPath: wallet.derivationPath } : {}),
    ...(typeof wallet.coinType === "number" ? { coinType: wallet.coinType } : {}),
    ...(typeof wallet.accountIndex === "number" ? { accountIndex: wallet.accountIndex } : {}),
    ...(typeof wallet.addressIndex === "number" ? { addressIndex: wallet.addressIndex } : {})
  };
}

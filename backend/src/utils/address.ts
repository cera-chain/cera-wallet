import {
  isCeraAddress,
  isLegacyHexAddress,
  normalizeAddressForChain,
  toDisplayAddress
} from "./cera-address.js";

export const DEFAULT_HEX_ADDRESS_TYPE = "legacy_hex" as const;
export const DEFAULT_NAMED_ADDRESS_TYPE = "legacy_named" as const;
export const CERA_BECH32_ADDRESS_TYPE = "cera_bech32" as const;

export type AddressType =
  | typeof DEFAULT_HEX_ADDRESS_TYPE
  | typeof DEFAULT_NAMED_ADDRESS_TYPE
  | typeof CERA_BECH32_ADDRESS_TYPE;

export function normalizeAddress(address: string): string {
  return address.trim();
}

export { isCeraAddress, isLegacyHexAddress, normalizeAddressForChain, toDisplayAddress };

export function inferAddressType(address: string): AddressType {
  return isCeraAddress(address)
    ? CERA_BECH32_ADDRESS_TYPE
    : isLegacyHexAddress(address)
    ? DEFAULT_HEX_ADDRESS_TYPE
    : DEFAULT_NAMED_ADDRESS_TYPE;
}

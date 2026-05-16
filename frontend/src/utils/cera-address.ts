const HRP = "cera";
const BECH32M_CONST = 0x2bc830a3;
const CHARSET = "qpzry9x8gf2tvdw0s3jn54khce6mua7l";
const CHARSET_REV = new Map([...CHARSET].map((char, index) => [char, index]));

function polymod(values: number[]): number {
  const generators = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = ((chk & 0x1ffffff) << 5) ^ value;
    for (let index = 0; index < 5; index += 1) {
      if (((top >> index) & 1) === 1) {
        chk ^= generators[index];
      }
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  return [
    ...[...hrp].map((char) => char.charCodeAt(0) >> 5),
    0,
    ...[...hrp].map((char) => char.charCodeAt(0) & 31)
  ];
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] {
  let acc = 0;
  let bits = 0;
  const maxv = (1 << toBits) - 1;
  const result: number[] = [];

  for (const value of data) {
    if (value < 0 || value >> fromBits !== 0) {
      throw new Error("invalid bech32 data range");
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      result.push((acc >> bits) & maxv);
    }
  }

  if (pad) {
    if (bits > 0) {
      result.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv) !== 0) {
    throw new Error("invalid bech32 padding");
  }

  return result;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const mod = polymod([...hrpExpand(hrp), ...data, 0, 0, 0, 0, 0, 0]) ^ BECH32M_CONST;
  return [0, 1, 2, 3, 4, 5].map((index) => (mod >> (5 * (5 - index))) & 31);
}

function verifyChecksum(hrp: string, data: number[]): boolean {
  return polymod([...hrpExpand(hrp), ...data]) === BECH32M_CONST;
}

function hexToBytes(hex: string): number[] {
  return hex.match(/.{2}/g)?.map((byte) => Number.parseInt(byte, 16)) ?? [];
}

function bytesToHex(bytes: number[]): string {
  return bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function isLegacyHexAddress(address: string): boolean {
  return /^[0-9a-fA-F]{64}$/.test(address.trim().replace(/^0x/i, ""));
}

export function isCeraAddress(address: string): boolean {
  return address.trim().toLowerCase().startsWith(`${HRP}1`);
}

export function legacyHexToCeraAddress(address: string): string {
  const clean = address.trim().replace(/^0x/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error("legacy CERA address must be 32-byte hex");
  }
  const data = convertBits(hexToBytes(clean), 8, 5, true);
  return `${HRP}1${[...data, ...createChecksum(HRP, data)].map((value) => CHARSET[value]).join("")}`;
}

export function ceraAddressToLegacyHex(address: string): string {
  const clean = address.trim();
  if (clean !== clean.toLowerCase() && clean !== clean.toUpperCase()) {
    throw new Error("CERA address cannot mix upper and lower case");
  }
  const lower = clean.toLowerCase();
  const separator = lower.lastIndexOf("1");
  if (separator <= 0 || lower.slice(0, separator) !== HRP) {
    throw new Error("CERA address must start with cera1");
  }
  const data = [...lower.slice(separator + 1)].map((char) => {
    const value = CHARSET_REV.get(char);
    if (value === undefined) {
      throw new Error("CERA address contains invalid bech32 character");
    }
    return value;
  });
  if (data.length < 7 || !verifyChecksum(HRP, data)) {
    throw new Error("CERA address checksum is invalid");
  }
  const payload = convertBits(data.slice(0, -6), 5, 8, false);
  if (payload.length !== 32) {
    throw new Error("CERA address payload must be 32 bytes");
  }
  return `0x${bytesToHex(payload)}`;
}

export function normalizeAddressForChain(address: string): string {
  const clean = address.trim();
  if (isCeraAddress(clean)) {
    return ceraAddressToLegacyHex(clean);
  }
  if (isLegacyHexAddress(clean)) {
    return `0x${clean.replace(/^0x/i, "").toLowerCase()}`;
  }
  return clean;
}

export function toDisplayAddress(address: string): string {
  const clean = address.trim();
  if (isCeraAddress(clean)) {
    return clean.toLowerCase();
  }
  if (isLegacyHexAddress(clean)) {
    return legacyHexToCeraAddress(clean);
  }
  return clean;
}

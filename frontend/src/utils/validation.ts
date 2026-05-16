import type { SendTxPayload } from "../services/tx";
import { isCeraAddress, isLegacyHexAddress } from "./cera-address";

export type ValidationErrors = Partial<Record<keyof SendTxPayload | "form", string>>;

function isLikelyAddress(value: string) {
  return isCeraAddress(value) || isLegacyHexAddress(value);
}

function isPositiveNumberString(value: string) {
  return /^\d+(\.\d+)?$/.test(value) && Number(value) > 0;
}

export function validateSendTxPayload(payload: SendTxPayload): ValidationErrors {
  const errors: ValidationErrors = {};

  if (payload.from && !isLikelyAddress(payload.from)) {
    errors.from = "From address format is invalid. Expected cera1... or legacy 0x address.";
  }

  if (!payload.to || !isLikelyAddress(payload.to)) {
    errors.to = "To address format is invalid. Expected cera1... or legacy 0x address.";
  }

  if (!payload.amount || !isPositiveNumberString(payload.amount)) {
    errors.amount = "Amount must be a number greater than 0.";
  }

  if (payload.fee && !isPositiveNumberString(payload.fee)) {
    errors.fee = "Fee must be a number greater than 0.";
  }

  if (!payload.privateKey || payload.privateKey.trim().length < 16) {
    errors.privateKey = "Private key is too short to be used as signing material.";
  }

  if (payload.nonce != null && (!Number.isInteger(payload.nonce) || payload.nonce < 0)) {
    errors.nonce = "Nonce must be an integer greater than or equal to 0.";
  }

  return errors;
}

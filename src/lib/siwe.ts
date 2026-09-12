import { SiweMessage } from "siwe";
import { isAddress, getAddress } from "viem";
import { getSiweConfig } from "../config/siwe";
import { nonceStore } from "./nonce";

export interface CreateSiweMessageParams {
  address: string;
  nonce?: string;
  statement?: string;
  uri?: string;
  chainId?: number;
  issuedAt?: string;
  expirationTime?: string;
  notBefore?: string;
  requestId?: string;
  resources?: string[];
}

/**
 * Constructs an EIP-4361 compliant SIWE message using server-configured domain,
 * chainId, and server-generated/verified nonce.
 *
 * NOTE: Signature verification is NOT performed in this phase.
 */
export function createSiweMessage(params: CreateSiweMessageParams): SiweMessage {
  if (!params.address || !isAddress(params.address)) {
    throw new Error(`Invalid Ethereum address provided: ${params.address}`);
  }

  const checksummedAddress = getAddress(params.address);
  const config = getSiweConfig();

  // Use provided nonce (and ensure it was issued by server) or issue a new valid nonce
  let effectiveNonce = params.nonce;
  if (!effectiveNonce) {
    effectiveNonce = nonceStore.generateAndStore();
  } else if (!nonceStore.isValid(effectiveNonce)) {
    throw new Error("Invalid or expired nonce for SIWE message construction");
  }

  const message = new SiweMessage({
    domain: config.domain,
    address: checksummedAddress,
    statement: params.statement ?? config.statement,
    uri: params.uri ?? config.origin,
    version: "1",
    chainId: params.chainId ?? config.chainId,
    nonce: effectiveNonce,
    issuedAt: params.issuedAt ?? new Date().toISOString(),
    expirationTime: params.expirationTime,
    notBefore: params.notBefore,
    requestId: params.requestId,
    resources: params.resources,
  });

  return message;
}

export interface SiweConfig {
  domain: string;
  origin: string;
  chainId: number;
  statement: string;
  nonceTtlMs: number;
}

export function getSiweConfig(): SiweConfig {
  const domain = process.env.SIWE_DOMAIN || "localhost:3000";
  const origin = process.env.SIWE_ORIGIN || `http://${domain}`;
  const rawChainId = process.env.SIWE_CHAIN_ID || process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || "1";
  const chainId = parseInt(rawChainId, 10);
  const statement =
    process.env.SIWE_STATEMENT || "Sign in with Ethereum to the application.";
  const rawTtlSeconds = process.env.NONCE_TTL_SECONDS || "300";
  const nonceTtlSeconds = parseInt(rawTtlSeconds, 10);

  if (!domain || typeof domain !== "string" || domain.trim() === "") {
    throw new Error("Invalid SIWE configuration: SIWE_DOMAIN must be a non-empty string");
  }

  if (isNaN(chainId) || chainId <= 0) {
    throw new Error(`Invalid SIWE configuration: chainId must be a positive integer, received '${rawChainId}'`);
  }

  if (isNaN(nonceTtlSeconds) || nonceTtlSeconds <= 0) {
    throw new Error(
      `Invalid SIWE configuration: NONCE_TTL_SECONDS must be a positive integer, received '${rawTtlSeconds}'`
    );
  }

  return {
    domain: domain.trim(),
    origin: origin.trim(),
    chainId,
    statement: statement.trim(),
    nonceTtlMs: nonceTtlSeconds * 1000,
  };
}

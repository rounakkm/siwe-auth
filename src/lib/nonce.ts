import { generateNonce } from "siwe";
import { getSiweConfig } from "../config/siwe";

export interface NonceEntry {
  nonce: string;
  issuedAt: number;
  expiresAt: number;
}

export interface INonceStore {
  generateAndStore(ttlMs?: number): string;
  has(nonce: string): boolean;
  isValid(nonce: string): boolean;
  get(nonce: string): NonceEntry | undefined;
  cleanExpired(): void;
  clear(): void;
}

export class InMemoryNonceStore implements INonceStore {
  private store: Map<string, NonceEntry> = new Map();

  /**
   * Generates a cryptographically secure nonce using SIWE's generator and stores it with an expiration timestamp.
   */
  generateAndStore(ttlMs?: number): string {
    this.cleanExpired();

    const config = getSiweConfig();
    const effectiveTtl = ttlMs && ttlMs > 0 ? ttlMs : config.nonceTtlMs;
    const nonce = generateNonce();
    const now = Date.now();

    this.store.set(nonce, {
      nonce,
      issuedAt: now,
      expiresAt: now + effectiveTtl,
    });

    return nonce;
  }

  /**
   * Checks if the nonce exists in the store (regardless of expiration).
   */
  has(nonce: string): boolean {
    return this.store.has(nonce);
  }

  /**
   * Checks if the nonce exists and has not expired.
   * NOTE: Does NOT consume or delete the nonce (consumption happens after signature verification in Phase 3).
   */
  isValid(nonce: string): boolean {
    const entry = this.store.get(nonce);
    if (!entry) {
      return false;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(nonce);
      return false;
    }

    return true;
  }

  /**
   * Retrieves the raw entry for a nonce if it exists.
   */
  get(nonce: string): NonceEntry | undefined {
    return this.store.get(nonce);
  }

  /**
   * Removes expired nonces from memory.
   */
  cleanExpired(): void {
    const now = Date.now();
    for (const [nonce, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(nonce);
      }
    }
  }

  /**
   * Clears all nonces (useful for testing).
   */
  clear(): void {
    this.store.clear();
  }
}

// Preserve singleton across hot reloads in development
const globalForNonce = globalThis as unknown as {
  siweNonceStore?: InMemoryNonceStore;
};

export const nonceStore = globalForNonce.siweNonceStore ?? new InMemoryNonceStore();

if (process.env.NODE_ENV !== "production") {
  globalForNonce.siweNonceStore = nonceStore;
}

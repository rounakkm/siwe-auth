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
  consume(nonce: string): boolean;
  get(nonce: string): NonceEntry | undefined;
  cleanExpired(): void;
  clear(): void;
}

export class InMemoryNonceStore implements INonceStore {
  private store: Map<string, NonceEntry> = new Map();


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

  has(nonce: string): boolean {
    return this.store.has(nonce);
  }


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


  consume(nonce: string): boolean {
    if (!this.isValid(nonce)) {
      return false;
    }

    this.store.delete(nonce);
    return true;
  }


  get(nonce: string): NonceEntry | undefined {
    return this.store.get(nonce);
  }


  cleanExpired(): void {
    const now = Date.now();
    for (const [nonce, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(nonce);
      }
    }
  }


  clear(): void {
    this.store.clear();
  }
}


const globalForNonce = globalThis as unknown as {
  siweNonceStore?: InMemoryNonceStore;
};

export const nonceStore = globalForNonce.siweNonceStore ?? new InMemoryNonceStore();

if (process.env.NODE_ENV !== "production") {
  globalForNonce.siweNonceStore = nonceStore;
}

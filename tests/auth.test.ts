import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { InMemoryNonceStore, nonceStore } from "@/lib/nonce";
import { createSiweMessage } from "@/lib/siwe";
import { getSiweConfig } from "@/config/siwe";
import { GET as getNonceRoute } from "@/app/api/auth/nonce/route";

describe("Phase 2: Server-side Nonce and SIWE Message Construction", () => {
  const TEST_WALLET_ADDRESS = "0xd8da6bf26964af9d7eed9e03e53415d37aa96045"; // vitalik.eth

  beforeEach(() => {
    nonceStore.clear();
  });

  test("1. Nonce is generated server-side with expected format", () => {
    const store = new InMemoryNonceStore();
    const nonce = store.generateAndStore();

    assert.equal(typeof nonce, "string");
    assert.ok(nonce.length >= 8, "Nonce must be at least 8 characters");
    assert.match(nonce, /^[a-zA-Z0-9]+$/, "Nonce must be alphanumeric");
  });

  test("2. Separate nonce requests produce different nonces (cryptographically random)", () => {
    const store = new InMemoryNonceStore();
    const nonce1 = store.generateAndStore();
    const nonce2 = store.generateAndStore();
    const nonce3 = store.generateAndStore();

    assert.notEqual(nonce1, nonce2);
    assert.notEqual(nonce2, nonce3);
    assert.notEqual(nonce1, nonce3);
  });

  test("3. Issued nonce is stored and retrievable as valid", () => {
    const store = new InMemoryNonceStore();
    const nonce = store.generateAndStore();

    assert.equal(store.has(nonce), true);
    assert.equal(store.isValid(nonce), true);

    const entry = store.get(nonce);
    assert.ok(entry);
    assert.equal(entry?.nonce, nonce);
    assert.ok((entry?.expiresAt ?? 0) > Date.now());
  });

  test("4. Nonce respects expiration TTL and invalidates correctly", async () => {
    const store = new InMemoryNonceStore();
    const shortTtlMs = 50; // 50ms TTL
    const nonce = store.generateAndStore(shortTtlMs);

    assert.equal(store.isValid(nonce), true);

    // Wait for TTL to expire
    await new Promise((resolve) => setTimeout(resolve, 60));

    assert.equal(store.isValid(nonce), false);
  });

  test("5. SIWE message uses the configured domain", () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const message = createSiweMessage({
      address: TEST_WALLET_ADDRESS,
      nonce,
    });

    assert.equal(message.domain, config.domain);
    const preparedMessage = message.prepareMessage();
    assert.ok(
      preparedMessage.startsWith(`${config.domain} wants you to sign in with your Ethereum account:`),
      "Prepared SIWE message header must include configured domain"
    );
  });

  test("6. SIWE message uses the configured chain ID", () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const message = createSiweMessage({
      address: TEST_WALLET_ADDRESS,
      nonce,
    });

    assert.equal(message.chainId, config.chainId);
    const preparedMessage = message.prepareMessage();
    assert.ok(
      preparedMessage.includes(`Chain ID: ${config.chainId}`),
      "Prepared SIWE message must include configured chain ID"
    );
  });

  test("7. SIWE message contains the issued nonce", () => {
    const nonce = nonceStore.generateAndStore();

    const message = createSiweMessage({
      address: TEST_WALLET_ADDRESS,
      nonce,
    });

    assert.equal(message.nonce, nonce);
    const preparedMessage = message.prepareMessage();
    assert.ok(
      preparedMessage.includes(`Nonce: ${nonce}`),
      "Prepared SIWE message must include the issued nonce"
    );
  });

  test("8. SIWE message auto-issues and stores a server nonce if none was provided", () => {
    const message = createSiweMessage({
      address: TEST_WALLET_ADDRESS,
    });

    assert.ok(message.nonce);
    assert.equal(nonceStore.isValid(message.nonce), true);
  });

  test("9. Rejects SIWE message construction with invalid or unissued nonce", () => {
    assert.throws(
      () => {
        createSiweMessage({
          address: TEST_WALLET_ADDRESS,
          nonce: "unissued-fake-nonce-123",
        });
      },
      {
        message: /Invalid or expired nonce/,
      }
    );
  });

  test("10. Rejects invalid Ethereum wallet addresses", () => {
    assert.throws(
      () => {
        createSiweMessage({
          address: "not-an-eth-address",
        });
      },
      {
        message: /Invalid Ethereum address/,
      }
    );
  });

  test("11. GET /api/auth/nonce endpoint returns 200 with stored server nonce", async () => {
    const response = await getNonceRoute();
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.ok(data.nonce);
    assert.equal(typeof data.nonce, "string");
    assert.equal(nonceStore.isValid(data.nonce), true);
  });
});

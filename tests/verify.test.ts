import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount, generatePrivateKey } from "viem/accounts";
import { getAddress, hashMessage, type Hex } from "viem";
import { SiweMessage } from "siwe";
import { InMemoryNonceStore, nonceStore } from "@/lib/nonce";
import { createSiweMessage } from "@/lib/siwe";
import { getSiweConfig } from "@/config/siwe";
import { verifySiweAuth, ERC1271_MAGIC_VALUE, ERC1271_ABI } from "@/lib/verify";
import { POST as verifyRoute } from "@/app/api/auth/verify/route";
import { NextRequest } from "next/server";

describe("Phase 3: SIWE Signature Verification", () => {
  // Deterministic test pvt keys
  const ACCOUNT_1_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const ACCOUNT_2_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  const account1 = privateKeyToAccount(ACCOUNT_1_KEY);
  const account2 = privateKeyToAccount(ACCOUNT_2_KEY);

  beforeEach(() => {
    nonceStore.clear();
  });

  test("1. Valid EOA SIWE authentication succeeds", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });

    assert.equal(result.success, true);
    assert.equal(result.address, account1.address);
    assert.equal(result.chainId, config.chainId);
  });

  test("2. Invalid signature fails", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    // Signed with account2 instead of account1
    const invalidSignature = await account2.signMessage({ message: preparedMessage });

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature: invalidSignature,
    });

    assert.equal(result.success, false);
    assert.match(result.error || "", /Invalid cryptographic signature/);
  });

  test("3. Wrong domain fails", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: "attacker-controlled-domain.xyz",
      address: account1.address,
      statement: config.statement,
      uri: "https://attacker-controlled-domain.xyz",
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });

    assert.equal(result.success, false);
    assert.match(result.error || "", /SIWE domain mismatch/);
  });

  test("4. Wrong chain ID fails", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const wrongChainId = config.chainId === 1 ? 137 : 1;
    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: wrongChainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });

    assert.equal(result.success, false);
    assert.match(result.error || "", /SIWE chain ID mismatch/);
  });

  test("5. Expired or not-yet-valid message fails", async () => {
    const config = getSiweConfig();
    const now = Date.now();

    const nonce1 = nonceStore.generateAndStore();
    const expiredSiwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce: nonce1,
      issuedAt: new Date(now - 10000).toISOString(),
      expirationTime: new Date(now - 1000).toISOString(),
    });
    const expMsg = expiredSiwe.prepareMessage();
    const expSig = await account1.signMessage({ message: expMsg });
    const expResult = await verifySiweAuth({ message: expMsg, signature: expSig });
    assert.equal(expResult.success, false);
    assert.match(expResult.error || "", /expired/i);

    
    const nonce2 = nonceStore.generateAndStore();
    const futureSiwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce: nonce2,
      issuedAt: new Date(now).toISOString(),
      notBefore: new Date(now + 60000).toISOString(),
    });
    const futMsg = futureSiwe.prepareMessage();
    const futSig = await account1.signMessage({ message: futMsg });
    const futResult = await verifySiweAuth({ message: futMsg, signature: futSig });
    assert.equal(futResult.success, false);
    assert.match(futResult.error || "", /not yet valid/i);
  });

  test("6. Unknown nonce fails", async () => {
    const config = getSiweConfig();
    const unissuedNonce = "UnissuedNonce123";

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce: unissuedNonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });

    assert.equal(result.success, false);
    assert.match(result.error || "", /Invalid, expired, or unissued nonce/);
  });

  test("7. Expired nonce fails", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore(50); // 50ms TTL

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    
    await new Promise((resolve) => setTimeout(resolve, 60));

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });

    assert.equal(result.success, false);
    assert.match(result.error || "", /Invalid, expired, or unissued nonce/);
  });

  test("8. Failed verification does NOT consume the nonce", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const wrongSignature = await account2.signMessage({ message: preparedMessage });

    
    const failedResult = await verifySiweAuth({
      message: preparedMessage,
      signature: wrongSignature,
    });
    assert.equal(failedResult.success, false);

  
    assert.equal(nonceStore.isValid(nonce), true);

    
    const correctSignature = await account1.signMessage({ message: preparedMessage });
    const successResult = await verifySiweAuth({
      message: preparedMessage,
      signature: correctSignature,
    });
    assert.equal(successResult.success, true);
  });

  test("9. Successful verification consumes the nonce", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    assert.equal(nonceStore.isValid(nonce), true);

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });

    assert.equal(result.success, true);
   
    assert.equal(nonceStore.isValid(nonce), false);
    assert.equal(nonceStore.has(nonce), false);
  });

  test("10. Replaying the same valid message/signature after success fails", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    // First verification succeeds
    const firstResult = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });
    assert.equal(firstResult.success, true);

    
    const replayResult = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });
    assert.equal(replayResult.success, false);
    assert.match(replayResult.error || "", /Invalid, expired, or unissued nonce/);
  });

  test("11. Client-supplied identity cannot override the verified SIWE address", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    
    const attackerAddress = "0x000000000000000000000000000000000000dEaD";
    const request = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: preparedMessage,
        signature,
        address: attackerAddress,
        claimedUser: attackerAddress,
      }),
    });

    const response = await verifyRoute(request);
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.address, account1.address);
    assert.notEqual(data.address, attackerAddress);
  });

  test("12. ERC-1271 contract-account verification works", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    
    const contractAddress = "0x1111111111111111111111111111111111111111" as `0x${string}`;
    const validContractSignature = "0x1234567890abcdef" as `0x${string}`;
    const invalidContractSignature = "0xdeadbeef" as `0x${string}`;

    const siwe = new SiweMessage({
      domain: config.domain,
      address: contractAddress,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const expectedHash = hashMessage(preparedMessage);

   
    const mockPublicClient = {
      async readContract({
        address,
        abi,
        functionName,
        args,
      }: {
        address: `0x${string}`;
        abi: any;
        functionName: string;
        args: any[];
      }) {
        if (
          address === contractAddress &&
          functionName === "isValidSignature" &&
          args[0] === expectedHash &&
          args[1] === validContractSignature
        ) {
          return ERC1271_MAGIC_VALUE; // 0x1626ba7e
        }
        return "0xffffffff"; 
      },
    };

  
    const validResult = await verifySiweAuth(
      {
        message: preparedMessage,
        signature: validContractSignature,
      },
      { publicClient: mockPublicClient }
    );

    assert.equal(validResult.success, true);
    assert.equal(validResult.address, getAddress(contractAddress));

   
    const nonceForInvalid = nonceStore.generateAndStore();
    const siweInvalid = new SiweMessage({
      domain: config.domain,
      address: contractAddress,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce: nonceForInvalid,
      issuedAt: new Date().toISOString(),
    });

    const invalidResult = await verifySiweAuth(
      {
        message: siweInvalid.prepareMessage(),
        signature: invalidContractSignature,
      },
      { publicClient: mockPublicClient }
    );

    assert.equal(invalidResult.success, false);
    assert.match(invalidResult.error || "", /Invalid cryptographic signature/);
    assert.equal(nonceStore.isValid(nonceForInvalid), true);
  });

  test("13. SIWE message with mismatched URI authority fails safely", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: "https://attacker-phishing.com/callback",
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    const result = await verifySiweAuth({
      message: preparedMessage,
      signature,
    });

    assert.equal(result.success, false);
    assert.match(result.error || "", /SIWE URI authority mismatch/);
    assert.equal(nonceStore.isValid(nonce), true);
  });

  test("14. Concurrent verification attempts with the same nonce only succeed once", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();

    const siwe = new SiweMessage({
      domain: config.domain,
      address: account1.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();
    const signature = await account1.signMessage({ message: preparedMessage });

    const results = await Promise.all([
      verifySiweAuth({ message: preparedMessage, signature }),
      verifySiweAuth({ message: preparedMessage, signature }),
      verifySiweAuth({ message: preparedMessage, signature }),
      verifySiweAuth({ message: preparedMessage, signature }),
      verifySiweAuth({ message: preparedMessage, signature }),
    ]);

    const successes = results.filter((r) => r.success);
    const failures = results.filter((r) => !r.success);

    assert.equal(successes.length, 1, "Exactly one concurrent verification must succeed");
    assert.equal(failures.length, 4, "All other concurrent verifications must fail");
    assert.equal(nonceStore.isValid(nonce), false, "Nonce must be consumed");
  });

  test("15. ERC-1271 contract call error or revert fails safely", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();
    const contractAddress = "0x2222222222222222222222222222222222222222" as `0x${string}`;

    const siwe = new SiweMessage({
      domain: config.domain,
      address: contractAddress,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siwe.prepareMessage();

    const revertingPublicClient = {
      async readContract() {
        throw new Error("Execution reverted: contract execution failed");
      },
    };

    const result = await verifySiweAuth(
      {
        message: preparedMessage,
        signature: "0x123456" as Hex,
      },
      { publicClient: revertingPublicClient }
    );

    assert.equal(result.success, false);
    assert.match(result.error || "", /Invalid cryptographic signature/);
    assert.equal(nonceStore.isValid(nonce), true);
  });

  test("16. Malformed SIWE message fails safely", async () => {
    const result = await verifySiweAuth({
      message: "not-a-valid-siwe-message-structure",
      signature: "0x123456",
    });

    assert.equal(result.success, false);
    assert.match(result.error || "", /Malformed SIWE message/);
  });
});

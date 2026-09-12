import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { SiweMessage } from "siwe";
import { NextRequest } from "next/server";
import { nonceStore } from "@/lib/nonce";
import { getSiweConfig } from "@/config/siwe";
import { getSession, InMemoryCookieStore } from "@/lib/session";
import { POST as verifyRoute } from "@/app/api/auth/verify/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";

describe("Phase 4: Server-Side Authenticated Sessions", () => {
  const TEST_PRIVATE_KEY_1 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const TEST_PRIVATE_KEY_2 = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

  const account1 = privateKeyToAccount(TEST_PRIVATE_KEY_1);
  const account2 = privateKeyToAccount(TEST_PRIVATE_KEY_2);

  beforeEach(() => {
    nonceStore.clear();
  });

  test("1. Unauthenticated session returns { authenticated: false }", async () => {
    const cookieStore = new InMemoryCookieStore();
    const response = await sessionRoute(undefined, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.authenticated, false);
    assert.equal(data.address, undefined);
  });

  test("2. Successful SIWE verification creates an authenticated session with verified address", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();
    const cookieStore = new InMemoryCookieStore();

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

    const request = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: preparedMessage,
        signature,
      }),
    });

    const verifyResponse = await verifyRoute(request, { cookieStore });
    assert.equal(verifyResponse.status, 200);

    const verifyData = await verifyResponse.json();
    assert.equal(verifyData.ok, true);
    assert.equal(verifyData.address, account1.address);

    // Verify session state inside cookie store
    const session = await getSession(cookieStore);
    assert.equal(session.authenticated, true);
    assert.equal(session.address, account1.address);

    // Verify GET /api/auth/session returns authenticated status and verified address
    const sessionResponse = await sessionRoute(undefined, { cookieStore });
    assert.equal(sessionResponse.status, 200);

    const sessionData = await sessionResponse.json();
    assert.equal(sessionData.authenticated, true);
    assert.equal(sessionData.address, account1.address);
  });

  test("3. Client-supplied address in request cannot override the verified session address", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();
    const cookieStore = new InMemoryCookieStore();

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
        overrideAddress: attackerAddress,
      }),
    });

    const verifyResponse = await verifyRoute(request, { cookieStore });
    assert.equal(verifyResponse.status, 200);

    const session = await getSession(cookieStore);
    assert.equal(session.authenticated, true);
    assert.equal(session.address, account1.address);
    assert.notEqual(session.address, attackerAddress);
  });

  test("4. Failed SIWE verification does NOT create an authenticated session", async () => {
    const config = getSiweConfig();
    const nonce = nonceStore.generateAndStore();
    const cookieStore = new InMemoryCookieStore();

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
    const invalidSignature = await account2.signMessage({ message: preparedMessage });

    const request = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: preparedMessage,
        signature: invalidSignature,
      }),
    });

    const verifyResponse = await verifyRoute(request, { cookieStore });
    assert.equal(verifyResponse.status, 422);

    const session = await getSession(cookieStore);
    assert.equal(session.authenticated, false);
    assert.equal(session.address, undefined);

    const sessionResponse = await sessionRoute(undefined, { cookieStore });
    const sessionData = await sessionResponse.json();
    assert.equal(sessionData.authenticated, false);
  });

  test("5. POST /api/auth/logout clears the authenticated session", async () => {
    const cookieStore = new InMemoryCookieStore();

    const session = await getSession(cookieStore);
    session.address = account1.address;
    session.authenticated = true;
    await session.save();

    const checkActive = await sessionRoute(undefined, { cookieStore });
    const activeData = await checkActive.json();
    assert.equal(activeData.authenticated, true);
    assert.equal(activeData.address, account1.address);

    const logoutResponse = await logoutRoute(undefined, { cookieStore });
    assert.equal(logoutResponse.status, 200);

    const logoutData = await logoutResponse.json();
    assert.equal(logoutData.ok, true);

    const checkLoggedOut = await sessionRoute(undefined, { cookieStore });
    const loggedOutData = await checkLoggedOut.json();
    assert.equal(loggedOutData.authenticated, false);
    assert.equal(loggedOutData.address, undefined);
  });

  test("6. POST /api/auth/logout is safe to call when already unauthenticated", async () => {
    const cookieStore = new InMemoryCookieStore();

    const logoutResponse = await logoutRoute(undefined, { cookieStore });
    assert.equal(logoutResponse.status, 200);

    const logoutData = await logoutResponse.json();
    assert.equal(logoutData.ok, true);

    const checkLoggedOut = await sessionRoute(undefined, { cookieStore });
    const loggedOutData = await checkLoggedOut.json();
    assert.equal(loggedOutData.authenticated, false);
  });
});

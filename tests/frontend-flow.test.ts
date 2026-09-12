import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { SiweMessage } from "siwe";
import { NextRequest } from "next/server";
import { nonceStore } from "@/lib/nonce";
import { getSiweConfig } from "@/config/siwe";
import { InMemoryCookieStore } from "@/lib/session";
import { GET as getNonceRoute } from "@/app/api/auth/nonce/route";
import { POST as verifyRoute } from "@/app/api/auth/verify/route";
import { GET as sessionRoute } from "@/app/api/auth/session/route";
import { POST as logoutRoute } from "@/app/api/auth/logout/route";
import { GET as listingsRoute } from "@/app/api/seller/listings/route";
import { GET as payoutRoute } from "@/app/api/seller/payout/route";
import { SELLERS } from "@/data/sellers";

describe("Phase 6: Frontend & Full Demo Integration Flow", () => {
  const ALICE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
  const alice = privateKeyToAccount(ALICE_KEY);

  beforeEach(() => {
    nonceStore.clear();
  });

  test("1. Full client auth flow: initial state -> nonce -> sign -> verify -> dashboard -> logout", async () => {
    const cookieStore = new InMemoryCookieStore();
    const config = getSiweConfig();

    // Step A: Client loads page and checks session (unauthenticated)
    const initialSessionRes = await sessionRoute(undefined, { cookieStore });
    const initialSession = await initialSessionRes.json();
    assert.equal(initialSession.authenticated, false);
    assert.equal(initialSession.address, undefined);

    // Step B: Unauthenticated access to seller dashboard endpoints is blocked
    const unauthListingsReq = new NextRequest("http://localhost:3000/api/seller/listings");
    const unauthListingsRes = await listingsRoute(unauthListingsReq, { cookieStore });
    assert.equal(unauthListingsRes.status, 401);

    const unauthPayoutReq = new NextRequest("http://localhost:3000/api/seller/payout");
    const unauthPayoutRes = await payoutRoute(unauthPayoutReq, { cookieStore });
    assert.equal(unauthPayoutRes.status, 401);

    // Step C: Client requests nonce from server
    const nonceRes = await getNonceRoute();
    assert.equal(nonceRes.status, 200);
    const { nonce } = await nonceRes.json();
    assert.ok(nonce);

    // Step D: Client constructs SIWE message using server domain, chain, and nonce
    const siweMessage = new SiweMessage({
      domain: config.domain,
      address: alice.address,
      statement: config.statement,
      uri: config.origin,
      version: "1",
      chainId: config.chainId,
      nonce,
      issuedAt: new Date().toISOString(),
    });

    const preparedMessage = siweMessage.prepareMessage();

    // Step E: Client wallet signs the prepared message
    const signature = await alice.signMessage({ message: preparedMessage });

    // Step F: Client POSTs { message, signature } to /api/auth/verify
    const verifyReq = new NextRequest("http://localhost:3000/api/auth/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: preparedMessage,
        signature,
      }),
    });

    const verifyRes = await verifyRoute(verifyReq, { cookieStore });
    assert.equal(verifyRes.status, 200);
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.ok, true);
    assert.equal(verifyData.address, alice.address);

    // Step G: Client checks session again (now authenticated)
    const authSessionRes = await sessionRoute(undefined, { cookieStore });
    assert.equal(authSessionRes.status, 200);
    const authSession = await authSessionRes.json();
    assert.equal(authSession.authenticated, true);
    assert.equal(authSession.address, alice.address);

    // Step H: Client loads seller dashboard data (without providing any address in request)
    const listingsReq = new NextRequest("http://localhost:3000/api/seller/listings");
    const listingsRes = await listingsRoute(listingsReq, { cookieStore });
    assert.equal(listingsRes.status, 200);
    const listingsData = await listingsRes.json();
    assert.equal(listingsData.ok, true);
    assert.equal(listingsData.address, alice.address);
    assert.equal(listingsData.listings.length, 2);

    const payoutReq = new NextRequest("http://localhost:3000/api/seller/payout");
    const payoutRes = await payoutRoute(payoutReq, { cookieStore });
    assert.equal(payoutRes.status, 200);
    const payoutData = await payoutRes.json();
    assert.equal(payoutData.ok, true);
    assert.equal(payoutData.payout.payoutAddress, alice.address);
    assert.equal(payoutData.payout.pendingCents, 22500);

    // Step I: Client clicks logout
    const logoutRes = await logoutRoute(undefined, { cookieStore });
    assert.equal(logoutRes.status, 200);
    const logoutData = await logoutRes.json();
    assert.equal(logoutData.ok, true);

    // Step J: Client verifies session is now unauthenticated
    const postLogoutSessionRes = await sessionRoute(undefined, { cookieStore });
    const postLogoutSession = await postLogoutSessionRes.json();
    assert.equal(postLogoutSession.authenticated, false);
    assert.equal(postLogoutSession.address, undefined);

    // Step K: Seller dashboard endpoints are now 401 again
    const postLogoutListingsRes = await listingsRoute(
      new NextRequest("http://localhost:3000/api/seller/listings"),
      { cookieStore }
    );
    assert.equal(postLogoutListingsRes.status, 401);
  });
});

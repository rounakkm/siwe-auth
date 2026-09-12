import test, { describe, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { privateKeyToAccount } from "viem/accounts";
import { getAddress } from "viem";
import { SiweMessage } from "siwe";
import { NextRequest } from "next/server";
import { nonceStore } from "@/lib/nonce";
import { getSiweConfig } from "@/config/siwe";
import { InMemoryCookieStore, getSession } from "@/lib/session";
import { POST as verifyRoute } from "@/app/api/auth/verify/route";
import { GET as listingsRoute } from "@/app/api/seller/listings/route";
import { GET as payoutRoute } from "@/app/api/seller/payout/route";
import { SELLERS } from "@/data/sellers";


const ALICE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
const BOB_KEY   = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

const alice = privateKeyToAccount(ALICE_KEY); // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
const bob   = privateKeyToAccount(BOB_KEY);   // 0x70997970C51812dc3A010C7d01b50e0d17dc79C8

async function signInAs(account: ReturnType<typeof privateKeyToAccount>): Promise<InMemoryCookieStore> {
  const config = getSiweConfig();
  const nonce = nonceStore.generateAndStore();
  const cookieStore = new InMemoryCookieStore();

  const siwe = new SiweMessage({
    domain: config.domain,
    address: account.address,
    statement: config.statement,
    uri: config.origin,
    version: "1",
    chainId: config.chainId,
    nonce,
    issuedAt: new Date().toISOString(),
  });

  const preparedMessage = siwe.prepareMessage();
  const signature = await account.signMessage({ message: preparedMessage });

  const req = new NextRequest("http://localhost:3000/api/auth/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: preparedMessage, signature }),
  });

  const verifyResponse = await verifyRoute(req, { cookieStore });
  assert.equal(verifyResponse.status, 200, "signInAs: verify must succeed");
  return cookieStore;
}

describe("Phase 5: Seller Authorization", () => {
  beforeEach(() => {
    nonceStore.clear();
  });

  test("1a. GET /api/seller/listings rejects unauthenticated request", async () => {
    const cookieStore = new InMemoryCookieStore();
    const req = new NextRequest("http://localhost:3000/api/seller/listings");

    const response = await listingsRoute(req, { cookieStore });
    assert.equal(response.status, 401);

    const data = await response.json();
    assert.equal(data.ok, false);
    assert.match(data.error, /Unauthorized/);
  });

  test("1b. GET /api/seller/payout rejects unauthenticated request", async () => {
    const cookieStore = new InMemoryCookieStore();
    const req = new NextRequest("http://localhost:3000/api/seller/payout");

    const response = await payoutRoute(req, { cookieStore });
    assert.equal(response.status, 401);

    const data = await response.json();
    assert.equal(data.ok, false);
    assert.match(data.error, /Unauthorized/);
  });

  test("2a. Alice's session returns Alice's listings", async () => {
    const cookieStore = await signInAs(alice);
    const req = new NextRequest("http://localhost:3000/api/seller/listings");

    const response = await listingsRoute(req, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.address, alice.address);

    const expectedListing = SELLERS.find(s => s.address === alice.address)!;
    assert.equal(data.listings.length, expectedListing.listings.length);
    assert.equal(data.listings[0].id, expectedListing.listings[0].id);
  });

  test("2b. Alice's session returns Alice's payout info", async () => {
    const cookieStore = await signInAs(alice);
    const req = new NextRequest("http://localhost:3000/api/seller/payout");

    const response = await payoutRoute(req, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.address, alice.address);
    assert.equal(
      data.payout.payoutAddress,
      SELLERS.find(s => s.address === alice.address)!.payout.payoutAddress
    );
  });

  test("2c. Bob's session returns Bob's listings", async () => {
    const cookieStore = await signInAs(bob);
    const req = new NextRequest("http://localhost:3000/api/seller/listings");

    const response = await listingsRoute(req, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.address, bob.address);

    const expectedListing = SELLERS.find(s => s.address === bob.address)!;
    assert.equal(data.listings.length, expectedListing.listings.length);
    assert.equal(data.listings[0].id, expectedListing.listings[0].id);
  });

  test("2d. Bob's session returns Bob's payout info", async () => {
    const cookieStore = await signInAs(bob);
    const req = new NextRequest("http://localhost:3000/api/seller/payout");

    const response = await payoutRoute(req, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.ok, true);
    assert.equal(data.address, bob.address);
    assert.equal(
      data.payout.payoutAddress,
      SELLERS.find(s => s.address === bob.address)!.payout.payoutAddress
    );
  });

  test("2e. Alice and Bob receive different listing sets", async () => {
    const aliceCookies = await signInAs(alice);
    const bobCookies   = await signInAs(bob);

    const aliceReq = new NextRequest("http://localhost:3000/api/seller/listings");
    const bobReq   = new NextRequest("http://localhost:3000/api/seller/listings");

    const [aliceRes, bobRes] = await Promise.all([
      listingsRoute(aliceReq, { cookieStore: aliceCookies }),
      listingsRoute(bobReq,   { cookieStore: bobCookies }),
    ]);

    const aliceData = await aliceRes.json();
    const bobData   = await bobRes.json();

    assert.notEqual(aliceData.address, bobData.address);
    const aliceIds = aliceData.listings.map((l: any) => l.id);
    const bobIds   = bobData.listings.map((l: any) => l.id);
    assert.ok(aliceIds.every((id: string) => !bobIds.includes(id)));
  });

  test("3a. Query param address cannot override session identity on /listings", async () => {
    
    const cookieStore = await signInAs(alice);
    const req = new NextRequest(
      `http://localhost:3000/api/seller/listings?address=${bob.address}`
    );

    const response = await listingsRoute(req, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.address, alice.address);
    assert.notEqual(data.address, bob.address);
    const aliceListingIds = SELLERS.find(s => s.address === alice.address)!.listings.map(l => l.id);
    const returnedIds = data.listings.map((l: any) => l.id);
    assert.deepEqual(returnedIds, aliceListingIds);
  });

  test("3b. Query param address cannot override session identity on /payout", async () => {
    const cookieStore = await signInAs(alice);
    const req = new NextRequest(
      `http://localhost:3000/api/seller/payout?address=${bob.address}&seller=${bob.address}`
    );

    const response = await payoutRoute(req, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.address, alice.address);
    assert.notEqual(data.address, bob.address);
    assert.equal(
      data.payout.payoutAddress,
      SELLERS.find(s => s.address === alice.address)!.payout.payoutAddress
    );
  });

  test("3c. Authenticated-as-Alice cannot see Bob's listings by any injection", async () => {
    const cookieStore = await signInAs(alice);

    const url = new URL("http://localhost:3000/api/seller/listings");
    url.searchParams.set("address", bob.address);
    url.searchParams.set("as", bob.address);
    url.searchParams.set("seller", bob.address);

    const req = new NextRequest(url.toString(), {
      headers: {
        "X-Seller-Address": bob.address,
        "X-Override-Address": bob.address,
      },
    });

    const response = await listingsRoute(req, { cookieStore });
    assert.equal(response.status, 200);

    const data = await response.json();
    assert.equal(data.address, alice.address, "Session identity must be alice, not bob");

    const bobListingIds = SELLERS.find(s => s.address === bob.address)!.listings.map(l => l.id);
    const returnedIds = data.listings.map((l: any) => l.id);
    assert.ok(
      returnedIds.every((id: string) => !bobListingIds.includes(id)),
      "No Bob listing IDs should appear in Alice's response"
    );
  });


  test("4. After logout and re-auth as Bob, listings switch to Bob's data", async () => {
    const aliceCookies = await signInAs(alice);

    const aliceReq = new NextRequest("http://localhost:3000/api/seller/listings");
    const aliceRes = await listingsRoute(aliceReq, { cookieStore: aliceCookies });
    const aliceData = await aliceRes.json();
    assert.equal(aliceData.address, alice.address);

    const session = await getSession(aliceCookies);
    session.destroy();

    const bobCookies = await signInAs(bob);
    const bobReq = new NextRequest("http://localhost:3000/api/seller/listings");
    const bobRes = await listingsRoute(bobReq, { cookieStore: bobCookies });
    const bobData = await bobRes.json();
    assert.equal(bobData.address, bob.address);
    assert.notEqual(bobData.address, alice.address);
  });
});

import { getAddress } from "viem";

/**
 * Seller data types
 */
export interface SellerListing {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  createdAt: string;
}

export interface SellerPayout {
  pendingCents: number;
  currency: string;
  payoutAddress: string;
  nextScheduledDate: string;
}

export interface Seller {
  address: `0x${string}`;
  displayName: string;
  listings: SellerListing[];
  payout: SellerPayout;
}

/**
 * Static in-memory seller data for the prototype.
 * Two distinct seller identities with separate listings and payout info.
 */
const SELLERS: Seller[] = [
  {
    address: getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
    displayName: "Alice",
    listings: [
      {
        id: "listing-a-1",
        title: "Vintage Camera Lens",
        description: "35mm f/1.8 prime lens in excellent condition",
        priceCents: 18000,
        currency: "USD",
        createdAt: "2026-09-01T00:00:00Z",
      },
      {
        id: "listing-a-2",
        title: "Film Photography Book",
        description: "Rare collector's edition, signed by the author",
        priceCents: 4500,
        currency: "USD",
        createdAt: "2026-09-05T00:00:00Z",
      },
    ],
    payout: {
      pendingCents: 22500,
      currency: "USD",
      payoutAddress: getAddress("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
      nextScheduledDate: "2026-09-30T00:00:00Z",
    },
  },
  {
    address: getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
    displayName: "Bob",
    listings: [
      {
        id: "listing-b-1",
        title: "Mechanical Keyboard",
        description: "Tactile 65% layout, custom keycaps",
        priceCents: 22000,
        currency: "USD",
        createdAt: "2026-09-03T00:00:00Z",
      },
    ],
    payout: {
      pendingCents: 22000,
      currency: "USD",
      payoutAddress: getAddress("0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
      nextScheduledDate: "2026-09-30T00:00:00Z",
    },
  },
];

/**
 * Returns the seller record for the given checksummed address, or undefined if not found.
 */
export function getSellerByAddress(address: string): Seller | undefined {
  try {
    const checksummed = getAddress(address);
    return SELLERS.find((s) => s.address === checksummed);
  } catch {
    return undefined;
  }
}

export { SELLERS };

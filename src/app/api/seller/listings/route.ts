import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getSellerByAddress } from "@/data/sellers";


export async function GET(
  _req: NextRequest,
  context?: { params?: Promise<Record<string, string>>; cookieStore?: any }
) {
  const auth = await requireAuth(context?.cookieStore);
  if (!auth.context) return auth.response;

  const { address } = auth.context;

  const seller = getSellerByAddress(address);

  if (!seller) {
    return NextResponse.json(
      { ok: false, error: "No seller account found for authenticated address" },
      { status: 404 }
    );
  }

  return NextResponse.json(
    { ok: true, address: seller.address, listings: seller.listings },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate" },
    }
  );
}

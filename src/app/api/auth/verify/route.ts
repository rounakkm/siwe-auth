import { NextRequest, NextResponse } from "next/server";
import { verifySiweAuth } from "@/lib/verify";
import { getSession } from "@/lib/session";


export async function POST(
  req: NextRequest,
  context?: { params?: Promise<Record<string, string>>; cookieStore?: any }
) {
  try {
    let body: any;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Invalid JSON request body" },
        { status: 400 }
      );
    }

    const { message, signature } = body || {};

    if (!message || !signature) {
      return NextResponse.json(
        {
          ok: false,
          error: "Missing required fields: 'message' and 'signature' are required",
        },
        { status: 400 }
      );
    }

    const result = await verifySiweAuth({ message, signature });

    if (!result.success) {
      return NextResponse.json(
        {
          ok: false,
          error: result.error || "Authentication verification failed",
        },
        { status: 422 }
      );
    }

   
    const session = await getSession(context?.cookieStore);
    session.address = result.address;
    session.authenticated = true;
    await session.save();

    return NextResponse.json(
      {
        ok: true,
        address: result.address,
        chainId: result.chainId,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Internal server error during verification",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

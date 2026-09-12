import { NextRequest, NextResponse } from "next/server";
import { verifySiweAuth } from "@/lib/verify";


export async function POST(req: NextRequest) {
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
